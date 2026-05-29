import csv
import io
import re
from datetime import datetime, date, timezone as dt_timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from ..models import Client, IngestionBatch, EmissionsRecord
from ..serializers import IngestionBatchSerializer

FUEL_FACTORS = {
    "diesel":       {"factor": 2.688, "scope": "scope1"},
    "petrol":       {"factor": 2.315, "scope": "scope1"},
    "gasoline":     {"factor": 2.315, "scope": "scope1"},
    "lng":          {"factor": 1.164, "scope": "scope1"},
    "lpg":          {"factor": 1.555, "scope": "scope1"},
    "fluessiggas":  {"factor": 1.555, "scope": "scope1"},
    "natural gas":  {"factor": 2.034, "scope": "scope1"},
    "erdgas":       {"factor": 2.034, "scope": "scope1"},
    "benzin":       {"factor": 2.315, "scope": "scope1"},
}

ELECTRICITY_FACTOR = 0.207

FLIGHT_FACTORS = {"short": 0.255, "medium": 0.195, "long": 0.150}
HOTEL_FACTOR = 31.0
GROUND_FACTOR = 0.170

AIRPORT_DISTANCES = {
    "LHR-JFK": 5540, "JFK-LHR": 5540,
    "LHR-CDG": 340,  "CDG-LHR": 340,
    "LHR-DXB": 5500, "DXB-LHR": 5500,
    "JFK-LAX": 3980, "LAX-JFK": 3980,
    "BOM-DEL": 1150, "DEL-BOM": 1150,
    "SIN-SYD": 6300, "SYD-SIN": 6300,
    "LHR-BOM": 7190, "BOM-LHR": 7190,
    "LHR-SIN": 10840,"SIN-LHR": 10840,
}


def parse_sap_date(raw: str) -> date:
    raw = raw.strip()
    if re.match(r"^\d{8}$", raw):
        return datetime.strptime(raw, "%Y%m%d").date()
    if re.match(r"^\d{2}\.\d{2}\.\d{4}$", raw):
        return datetime.strptime(raw, "%d.%m.%Y").date()
    try:
        return datetime.fromisoformat(raw).date()
    except Exception:
        return date.today()


def parse_date(raw: str) -> date:
    raw = raw.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return date.today()


def get_flight_factor(km: float) -> float:
    if km < 1500:
        return FLIGHT_FACTORS["short"]
    if km < 3500:
        return FLIGHT_FACTORS["medium"]
    return FLIGHT_FACTORS["long"]


def check_suspicious(co2e_kg: float, amount: float):
    if co2e_kg > 100_000:
        return True, f"CO₂e value unusually high: {co2e_kg:.0f} kg"
    if amount <= 0:
        return True, "Activity amount is zero or negative"
    return False, None


def normalize_keys(row: dict) -> dict:
    return {k.lower().strip().replace(" ", "_").replace("-", "_"): str(v).strip() for k, v in row.items()}


def parse_csv(content: str) -> list[dict]:
    for delimiter in [",", ";", "\t"]:
        try:
            reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
            rows = list(reader)
            if rows and len(rows[0]) > 1:
                return rows
        except Exception:
            continue
    return []


class IngestSAPView(APIView):
    def post(self, request):
        client_id = request.data.get("clientId")
        file = request.FILES.get("file")

        if not client_id:
            return Response({"error": "clientId is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not file:
            return Response({"error": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response({"error": "Client not found"}, status=status.HTTP_400_BAD_REQUEST)

        batch = IngestionBatch.objects.create(
            client=client, source_type="sap", filename=file.name, status="processing"
        )

        row_count = 0
        error_count = 0
        errors = []

        try:
            content = file.read().decode("utf-8", errors="replace")
            rows = parse_csv(content)

            for raw_row in rows:
                row_count += 1
                row = normalize_keys(raw_row)

                qty_raw = row.get("menge") or row.get("quantity") or row.get("qty") or row.get("amount", "")
                unit = (row.get("meins") or row.get("unit") or row.get("uom", "L")).lower()
                material = (row.get("matnr") or row.get("material") or row.get("material_description", "diesel")).lower()
                plant = row.get("werks") or row.get("plant", "")
                date_raw = row.get("budat") or row.get("posting_date") or row.get("date", "")
                company_code = row.get("bukrs") or row.get("company_code", "")

                try:
                    qty = float(qty_raw.replace(",", "."))
                except (ValueError, AttributeError):
                    error_count += 1
                    errors.append(f"Row {row_count}: invalid quantity '{qty_raw}'")
                    continue

                activity_date = parse_sap_date(date_raw)

                fuel_type = "diesel"
                for key in FUEL_FACTORS:
                    if key in material:
                        fuel_type = key
                        break
                factor_info = FUEL_FACTORS.get(fuel_type, FUEL_FACTORS["diesel"])

                litres = qty
                if unit in ("gal", "gallon"):
                    litres = qty * 3.78541
                elif unit in ("m3", "cbm"):
                    litres = qty * 1000

                co2e = litres * factor_info["factor"]
                suspicious, reason = check_suspicious(co2e, qty)

                EmissionsRecord.objects.create(
                    batch=batch,
                    client=client,
                    scope=factor_info["scope"],
                    category=fuel_type,
                    source_type="sap",
                    raw_data=raw_row,
                    activity_amount=litres,
                    activity_unit="litres",
                    normalized_co2e_kg=co2e,
                    activity_date=activity_date,
                    location=plant or company_code or None,
                    description=f"{material} combustion — plant {plant} ({company_code})",
                    is_suspicious=suspicious,
                    suspicious_reason=reason,
                )

        except Exception as e:
            error_count += 1
            errors.append(f"Failed to parse file: {e}")

        batch.status = "failed" if (error_count == row_count and row_count > 0) else "completed"
        batch.row_count = row_count
        batch.error_count = error_count
        batch.error_details = "\n".join(errors[:10]) if errors else None
        batch.completed_at = timezone.now()
        batch.save()

        return Response(IngestionBatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class IngestUtilityView(APIView):
    def post(self, request):
        client_id = request.data.get("clientId")
        file = request.FILES.get("file")

        if not client_id:
            return Response({"error": "clientId is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not file:
            return Response({"error": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response({"error": "Client not found"}, status=status.HTTP_400_BAD_REQUEST)

        batch = IngestionBatch.objects.create(
            client=client, source_type="utility", filename=file.name, status="processing"
        )

        row_count = 0
        error_count = 0
        errors = []

        try:
            content = file.read().decode("utf-8", errors="replace")
            rows = parse_csv(content)

            for raw_row in rows:
                row_count += 1
                row = normalize_keys(raw_row)

                kwh_raw = (row.get("consumption_kwh") or row.get("kwh") or
                           row.get("usage_kwh") or row.get("consumption", ""))
                unit = (row.get("unit") or row.get("uom", "kwh")).lower().replace(" ", "")
                period_start = (row.get("period_start") or row.get("start_date") or
                                row.get("billing_start") or row.get("date", ""))
                meter_id = row.get("meter_id") or row.get("meter") or row.get("account_number", "")
                site = (row.get("location") or row.get("site") or
                        row.get("facility") or row.get("address", ""))

                try:
                    kwh = float(kwh_raw.replace(",", ""))
                except (ValueError, AttributeError):
                    error_count += 1
                    errors.append(f"Row {row_count}: invalid consumption '{kwh_raw}'")
                    continue

                if unit == "mwh":
                    kwh *= 1000
                elif unit == "gwh":
                    kwh *= 1_000_000

                activity_date = parse_date(period_start)
                co2e = kwh * ELECTRICITY_FACTOR
                suspicious, reason = check_suspicious(co2e, kwh)

                EmissionsRecord.objects.create(
                    batch=batch,
                    client=client,
                    scope="scope2",
                    category="electricity",
                    source_type="utility",
                    raw_data=raw_row,
                    activity_amount=kwh,
                    activity_unit="kWh",
                    normalized_co2e_kg=co2e,
                    activity_date=activity_date,
                    location=site or meter_id or None,
                    description=f"Electricity — meter {meter_id}" + (f" at {site}" if site else ""),
                    is_suspicious=suspicious,
                    suspicious_reason=reason,
                )

        except Exception as e:
            error_count += 1
            errors.append(f"Failed to parse file: {e}")

        batch.status = "failed" if (error_count == row_count and row_count > 0) else "completed"
        batch.row_count = row_count
        batch.error_count = error_count
        batch.error_details = "\n".join(errors[:10]) if errors else None
        batch.completed_at = timezone.now()
        batch.save()

        return Response(IngestionBatchSerializer(batch).data, status=status.HTTP_201_CREATED)


class IngestTravelView(APIView):
    def post(self, request):
        client_id = request.data.get("clientId")
        file = request.FILES.get("file")

        if not client_id:
            return Response({"error": "clientId is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not file:
            return Response({"error": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response({"error": "Client not found"}, status=status.HTTP_400_BAD_REQUEST)

        batch = IngestionBatch.objects.create(
            client=client, source_type="travel", filename=file.name, status="processing"
        )

        row_count = 0
        error_count = 0
        errors = []

        try:
            content = file.read().decode("utf-8", errors="replace")
            rows = parse_csv(content)

            for raw_row in rows:
                row_count += 1
                row = normalize_keys(raw_row)

                trip_type = (row.get("trip_type") or row.get("type") or row.get("category", "flight")).lower()
                date_raw = (row.get("date") or row.get("departure_date") or
                            row.get("travel_date") or row.get("check_in", ""))
                traveler = row.get("traveler") or row.get("employee") or row.get("name", "")
                department = row.get("department") or row.get("cost_center") or row.get("team", "")

                activity_date = parse_date(date_raw)
                co2e = 0.0
                amount = 0.0
                unit = ""
                category = "flight"
                description = ""

                if "flight" in trip_type or "air" in trip_type:
                    category = "flight"
                    origin = row.get("origin") or row.get("departure") or row.get("from", "")
                    dest = row.get("destination") or row.get("arrival") or row.get("to", "")
                    dist_raw = row.get("distance_km") or row.get("distance") or row.get("km", "")
                    pax = int(row.get("passengers") or row.get("pax") or "1") if (row.get("passengers") or "1").isdigit() else 1

                    try:
                        dist_km = float(dist_raw)
                        if dist_km <= 0:
                            raise ValueError
                    except (ValueError, TypeError):
                        key = f"{origin.upper()}-{dest.upper()}"
                        dist_km = AIRPORT_DISTANCES.get(key, 2000)

                    factor = get_flight_factor(dist_km)
                    co2e = dist_km * factor * pax
                    amount = dist_km
                    unit = "km"
                    description = f"Flight {origin}→{dest} ({dist_km:.0f} km, {pax} pax) — {traveler}"

                elif "hotel" in trip_type or "accommodation" in trip_type or "lodg" in trip_type:
                    category = "hotel"
                    nights_raw = row.get("nights") or row.get("duration_nights") or "1"
                    try:
                        nights = float(nights_raw)
                    except (ValueError, TypeError):
                        nights = 1
                    co2e = nights * HOTEL_FACTOR
                    amount = nights
                    unit = "nights"
                    loc = row.get("hotel") or row.get("property") or row.get("destination") or row.get("city", "")
                    description = f"Hotel {loc} ({nights:.0f} nights) — {traveler}"

                else:
                    category = "ground_transport"
                    dist_raw = row.get("distance_km") or row.get("distance") or "50"
                    try:
                        dist_km = float(dist_raw)
                    except (ValueError, TypeError):
                        dist_km = 50
                    co2e = dist_km * GROUND_FACTOR
                    amount = dist_km
                    unit = "km"
                    frm = row.get("origin") or row.get("from") or row.get("pickup", "")
                    to = row.get("destination") or row.get("to") or row.get("dropoff", "")
                    description = f"Ground transport {frm}→{to} ({dist_km:.0f} km) — {traveler}"

                if department:
                    description += f" [{department}]"

                suspicious, reason = check_suspicious(co2e, amount)

                EmissionsRecord.objects.create(
                    batch=batch,
                    client=client,
                    scope="scope3",
                    category=category,
                    source_type="travel",
                    raw_data=raw_row,
                    activity_amount=amount,
                    activity_unit=unit,
                    normalized_co2e_kg=co2e,
                    activity_date=activity_date,
                    location=row.get("origin") or row.get("city") or None,
                    description=description,
                    is_suspicious=suspicious,
                    suspicious_reason=reason,
                )

        except Exception as e:
            error_count += 1
            errors.append(f"Failed to parse file: {e}")

        batch.status = "failed" if (error_count == row_count and row_count > 0) else "completed"
        batch.row_count = row_count
        batch.error_count = error_count
        batch.error_details = "\n".join(errors[:10]) if errors else None
        batch.completed_at = timezone.now()
        batch.save()

        return Response(IngestionBatchSerializer(batch).data, status=status.HTTP_201_CREATED)

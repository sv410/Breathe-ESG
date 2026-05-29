# Breathe ESG – Emissions Data Ingestion Prototype

## Overview

This project is a prototype ESG emissions ingestion and analyst review platform built for the Breathe ESG technical assignment.

The system ingests operational and emissions-related activity data from multiple enterprise sources, normalizes the data into a unified structure, and provides a review workflow for analysts before records are finalized for audit purposes.

The prototype focuses on realistic enterprise ingestion workflows rather than simplified demo CRUD patterns.

---

# Assignment Scope

The application supports ingestion and normalization for the following source types:

## 1. SAP Fuel & Procurement Data

* Simulated SAP flat-file export ingestion
* Handles inconsistent units and source formatting
* Supports procurement and fuel activity mapping
* Includes source tracking and normalization

## 2. Utility Electricity Data

* Utility CSV export ingestion
* Handles billing periods and electricity consumption units
* Supports energy normalization workflows

## 3. Corporate Travel Data

* Simulated travel platform export ingestion
* Supports flights, hotels, and ground transport categories
* Handles incomplete metadata such as missing distance values

---

# Core Features

* Multi-tenant architecture
* Scope 1 / Scope 2 / Scope 3 categorization
* Source-of-truth tracking
* Unit normalization pipeline
* Analyst review dashboard
* Approval and audit-ready workflow
* REST API architecture
* React frontend with Django backend
* Production deployment setup

---

# Tech Stack

## Frontend

* React
* Vite
* Tailwind CSS

## Backend

* Django
* Django REST Framework

## Deployment

* Frontend: Netlify
* Backend: Render

---

# Live Deployment

## Frontend

https://breatheesgs.netlify.app/

## Backend API

https://breathe-esg-api-sa26.onrender.com/

---

# Demo Credentials

Username: `analyst`
Password: `breathe2024`

> Note: The backend is hosted on Render’s free tier and may take approximately 30–50 seconds to respond on the first request.

---

# Repository Structure

```bash
project-root/
│
├── frontend/              # React frontend
├── backend/               # Django backend
│
├── MODEL.md               # Data model and architecture decisions
├── DECISIONS.md           # Assumptions and ambiguity resolutions
├── TRADEOFFS.md           # Intentional exclusions and tradeoffs
├── SOURCES.md             # Real-world source research and analysis
│
└── README.md
```

---

# Backend Setup

```bash
cd backend

python -m venv venv
```

Activate virtual environment:

## Windows

```bash
venv\Scripts\activate
```

## Mac/Linux

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
python manage.py migrate
```

Start backend server:

```bash
python manage.py runserver
```

Backend runs at:

```bash
http://127.0.0.1:8000
```

---

# Frontend Setup

```bash
cd frontend

npm install
```

Start development server:

```bash
npm run dev
```

Frontend runs at:

```bash
http://localhost:5173
```

---

# API Configuration

The frontend communicates with the Django backend using environment-based API routing.

Example production API base URL:

```bash
https://breathe-esg-api-sa26.onrender.com/
```

---

# Data Model Highlights

The system is designed around the following architectural principles:

* Tenant isolation for enterprise clients
* Immutable source tracking
* Review and approval lifecycle management
* Normalized emissions activity schema
* Unit standardization across heterogeneous source formats
* Auditability of ingestion and analyst actions

Detailed explanations are available in:

* `MODEL.md`
* `DECISIONS.md`
* `TRADEOFFS.md`
* `SOURCES.md`

---

# Design Decisions

This prototype intentionally prioritizes:

* Realistic ingestion workflows
* Explainable engineering decisions
* Clear data lineage
* Practical tradeoffs within a 4-day implementation window
* Extensible normalization architecture

The focus is on building a reliable ingestion and review foundation rather than a fully productionized emissions calculation engine.

---

# Future Improvements

Potential next steps include:

* Automated emissions factor mapping
* PDF utility bill parsing
* Async ingestion pipelines
* Role-based access control
* Data lineage visualization
* Bulk upload validation engine
* Advanced analytics dashboards
* Approval workflow automation

---

# Deliverables Included

| File         | Purpose                                |
| ------------ | -------------------------------------- |
| MODEL.md     | Data model and audit architecture      |
| DECISIONS.md | Product and engineering decisions      |
| TRADEOFFS.md | Intentional tradeoffs and exclusions   |
| SOURCES.md   | Source research and ingestion analysis |

---

# Author

Sri

Built as part of the Breathe ESG technical assignment.

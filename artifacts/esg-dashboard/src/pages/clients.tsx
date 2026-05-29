import { useState } from "react";
import { useListClients, useCreateClient } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Building2 } from "lucide-react";

export default function Clients() {
  const { data: clients, isLoading } = useListClients();
  const createClient = useCreateClient();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")) {
      setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClient.mutate({ data: { name, slug } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        setIsOpen(false);
        setName("");
        setSlug("");
      },
    });
  };

  return (
    <div className="p-8 max-w-[900px] mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage client organisations and data boundaries</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Create a new tenant. All ingested data will be scoped to this client.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Organisation Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Industrial Ltd"
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-sm font-medium">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-industrial"
                  pattern="[a-z0-9-]+"
                  required
                  className="h-10 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? "Creating…" : "Create Client"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-16">ID</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organisation</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slug</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {[1,2,3,4].map(j => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : clients?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-16 text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No clients yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Add your first client to start ingesting data</p>
                </TableCell>
              </TableRow>
            ) : (
              clients?.map((client) => (
                <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">{client.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{client.name[0]}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{client.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-xs bg-muted px-2 py-1 rounded border border-border text-foreground/70">{client.slug}</code>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground font-mono">
                    {format(new Date(client.createdAt), "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

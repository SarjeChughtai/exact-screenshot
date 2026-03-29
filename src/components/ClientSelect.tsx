import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, Plus } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import type { Client } from '@/types';

interface ClientSelectProps {
  mode: 'id' | 'name';
  valueId: string;
  valueName: string;
  onSelect: (client: { clientId: string; clientName: string }) => void;
  className?: string;
}

export function ClientSelect({ mode, valueId, valueName, onSelect, className }: ClientSelectProps) {
  const { clients, quickAddClient } = useAppContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    return clients.filter(c =>
      c.clientId.toLowerCase().includes(s) || c.clientName.toLowerCase().includes(s)
    );
  }, [clients, search]);

  const displayValue = mode === 'id' ? valueId : valueName;

  const handleSelect = (c: Client) => {
    onSelect({ clientId: c.clientId, clientName: c.clientName });
    setOpen(false);
    setSearch('');
  };

  const handleAdd = async () => {
    if (!newId && !newName) return;
    const id = newId || `C-${Date.now().toString(36).toUpperCase()}`;
    const name = newName || id;
    await quickAddClient(id, name);
    onSelect({ clientId: id, clientName: name });
    setNewId('');
    setNewName('');
    setShowAdd(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={`w-full justify-between text-left font-normal h-9 ${!displayValue ? 'text-muted-foreground' : ''} ${className || ''}`}>
          <span className="truncate">{displayValue || (mode === 'id' ? 'Select Client ID...' : 'Select Client...')}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs mb-2"
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filtered.map((c, i) => (
            <button
              key={i}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/10 flex justify-between"
              onClick={() => handleSelect(c)}
            >
              <span className="font-medium">{c.clientName}</span>
              <span className="text-muted-foreground">{c.clientId}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No clients found</p>}
        </div>
        <div className="border-t mt-2 pt-2">
          {!showAdd ? (
            <button
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/10 flex items-center gap-1 text-primary"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-3 w-3" /> Add new client
            </button>
          ) : (
            <div className="space-y-2 px-1">
              <div>
                <Label className="text-[10px]">Client ID</Label>
                <Input className="h-7 text-xs" value={newId} onChange={e => setNewId(e.target.value)} placeholder="e.g. 123456" />
              </div>
              <div>
                <Label className="text-[10px]">Client Name</Label>
                <Input className="h-7 text-xs" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Smith Farms" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAdd}>Add</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

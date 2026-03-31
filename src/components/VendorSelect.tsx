import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Plus } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import type { Vendor } from '@/types';

interface VendorSelectProps {
  valueId: string;
  valueName: string;
  onSelect: (vendor: { vendorId: string; vendorName: string; province: string }) => void;
  className?: string;
}

export function VendorSelect({ valueId, valueName, onSelect, className }: VendorSelectProps) {
  const { vendors, quickAddVendor } = useAppContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProvince, setNewProvince] = useState('ON');

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const normalized = search.toLowerCase();
    return vendors.filter(vendor =>
      vendor.name.toLowerCase().includes(normalized) ||
      vendor.province.toLowerCase().includes(normalized),
    );
  }, [search, vendors]);

  const displayValue = valueName || valueId;

  const handleSelect = (vendor: Vendor) => {
    onSelect({ vendorId: vendor.id, vendorName: vendor.name, province: vendor.province });
    setOpen(false);
    setSearch('');
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const vendor = await quickAddVendor(newName.trim(), newProvince);
    if (!vendor) return;
    onSelect({ vendorId: vendor.id, vendorName: vendor.name, province: vendor.province });
    setNewName('');
    setNewProvince('ON');
    setShowAdd(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={`w-full justify-between text-left font-normal h-9 ${!displayValue ? 'text-muted-foreground' : ''} ${className || ''}`}>
          <span className="truncate">{displayValue || 'Select vendor...'}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <Input
          placeholder="Search vendors..."
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="h-8 text-xs mb-2"
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filtered.map(vendor => (
            <button
              key={vendor.id}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/10 flex justify-between"
              onClick={() => handleSelect(vendor)}
            >
              <span className="font-medium">{vendor.name}</span>
              <span className="text-muted-foreground">{vendor.province}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No vendors found</p>}
        </div>
        <div className="border-t mt-2 pt-2">
          {!showAdd ? (
            <button
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent/10 flex items-center gap-1 text-primary"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-3 w-3" /> Add new vendor
            </button>
          ) : (
            <div className="space-y-2 px-1">
              <div>
                <Label className="text-[10px]">Vendor Name</Label>
                <Input className="h-7 text-xs" value={newName} onChange={event => setNewName(event.target.value)} placeholder="e.g. Prairie Steel" />
              </div>
              <div>
                <Label className="text-[10px]">Province</Label>
                <Select value={newProvince} onValueChange={setNewProvince}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'].map(code => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

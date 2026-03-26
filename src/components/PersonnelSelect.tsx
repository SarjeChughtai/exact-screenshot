import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettings, type PersonnelRole } from '@/context/SettingsContext';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PersonnelSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  role: PersonnelRole;
  placeholder?: string;
  className?: string;
}

export function PersonnelSelect({ value, onValueChange, role, placeholder = 'Select...', className }: PersonnelSelectProps) {
  const { settings, updateSettings } = useSettings();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const roleLabel = role === 'sales_rep' ? 'Sales Rep' : role === 'estimator' ? 'Estimator' : 'Team Lead';

  // Get people who have this role
  const people = settings.personnel.filter(p => (p.roles || [p.role]).includes(role));

  const handleAdd = () => {
    if (!newName.trim()) return;
    const existing = settings.personnel.find(p => p.name.toLowerCase() === newName.trim().toLowerCase());
    if (existing) {
      // Add role to existing person
      const updatedRoles = [...new Set([...(existing.roles || [existing.role]), role])];
      const updated = settings.personnel.map(p =>
        p.id === existing.id ? { ...p, roles: updatedRoles } : p
      );
      updateSettings({ personnel: updated });
      toast.success(`Added ${roleLabel} role to ${existing.name}`);
    } else {
      // Create new person
      const entry = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        email: '',
        role,
        roles: [role],
      };
      updateSettings({ personnel: [...settings.personnel, entry] });
      toast.success(`${newName.trim()} added as ${roleLabel}`);
    }
    onValueChange(newName.trim());
    setNewName('');
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="flex gap-1">
        <Input
          className={`input-blue h-9 ${className || ''}`}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={`New ${roleLabel} name...`}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') setAdding(false);
          }}
        />
        <Button size="sm" className="h-9 px-2" onClick={handleAdd}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={v => {
      if (v === '__add_new__') {
        setAdding(true);
      } else {
        onValueChange(v);
      }
    }}>
      <SelectTrigger className={`input-blue ${className || ''}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {people.map(p => (
          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
        ))}
        <SelectItem value="__add_new__" className="text-primary font-medium">
          <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Add new {roleLabel}</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

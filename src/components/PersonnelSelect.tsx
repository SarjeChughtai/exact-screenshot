import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings, type PersonnelRole } from '@/context/SettingsContext';

interface PersonnelSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  role: PersonnelRole;
  placeholder?: string;
  className?: string;
}

export function PersonnelSelect({ value, onValueChange, role, placeholder = 'Select...', className }: PersonnelSelectProps) {
  const { settings } = useSettings();
  const people = settings.personnel.filter(person => (person.roles || [person.role]).includes(role));

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`input-blue ${className || ''}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {people.map(person => (
          <SelectItem key={person.id} value={person.name}>
            {person.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

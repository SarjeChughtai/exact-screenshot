import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WALL_LABELS, type RFQOpening, type WallLocation } from '@/lib/rfqShared';

interface RFQOpeningsSectionProps {
  title: string;
  subtitle?: string;
  openings: RFQOpening[];
  onAddOpening: (wall: WallLocation) => void;
  onUpdateOpening: (id: string, key: keyof RFQOpening, value: string) => void;
  onRemoveOpening: (id: string) => void;
  addLabel?: string;
  emptyLabel?: string;
  widthLabel?: string;
  heightLabel?: string;
  notesLabel?: string;
  notesPlaceholder?: string;
}

const WALLS: WallLocation[] = ['LEW', 'REW', 'FSW', 'BSW'];

export function RFQOpeningsSection({
  title,
  subtitle,
  openings,
  onAddOpening,
  onUpdateOpening,
  onRemoveOpening,
  addLabel = 'Add Opening',
  emptyLabel = 'No openings added.',
  widthLabel = 'Width',
  heightLabel = 'Height',
  notesLabel = 'Notes',
  notesPlaceholder,
}: RFQOpeningsSectionProps) {
  return (
    <div className="bg-card border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {WALLS.map(wall => {
          const wallOpenings = openings.filter(opening => opening.wall === wall);

          return (
            <div key={wall} className="rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{WALL_LABELS[wall]}</p>
                  <p className="text-xs text-muted-foreground">{wallOpenings.length} openings</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onAddOpening(wall)}>
                  {addLabel}
                </Button>
              </div>

              <div className="space-y-3">
                {wallOpenings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{emptyLabel}</p>
                ) : wallOpenings.map(opening => (
                  <div key={opening.id} className="rounded-md bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">{opening.wall} #{opening.number}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => onRemoveOpening(opening.id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{widthLabel}</Label>
                        <Input
                          className="input-blue mt-1 h-8"
                          value={opening.width}
                          onChange={event => onUpdateOpening(opening.id, 'width', event.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{heightLabel}</Label>
                        <Input
                          className="input-blue mt-1 h-8"
                          value={opening.height}
                          onChange={event => onUpdateOpening(opening.id, 'height', event.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">{notesLabel}</Label>
                      <Textarea
                        className="text-xs min-h-[72px] mt-1"
                        value={opening.notes}
                        onChange={event => onUpdateOpening(opening.id, 'notes', event.target.value)}
                        placeholder={notesPlaceholder}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

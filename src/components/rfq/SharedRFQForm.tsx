import { useEffect } from 'react';
import { Send, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ClientSelect } from '@/components/ClientSelect';
import { JobIdSelect } from '@/components/JobIdSelect';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { RFQOpeningsSection } from '@/components/rfq/RFQOpeningsSection';
import { PROVINCES } from '@/lib/calculations';
import type { Deal } from '@/types';
import type { SharedRFQFormValues } from '@/lib/rfqForm';
import type { RFQOpening, WallLocation } from '@/lib/rfqShared';

type Variant = 'internal' | 'dealer';

interface EstimateOption {
  id: string;
  label: string;
}

interface SharedRFQFormProps {
  variant: Variant;
  value: SharedRFQFormValues;
  openings: RFQOpening[];
  onChange: <K extends keyof SharedRFQFormValues>(key: K, value: SharedRFQFormValues[K]) => void;
  onAddOpening: (wall: WallLocation) => void;
  onUpdateOpening: (id: string, key: keyof RFQOpening, value: string) => void;
  onRemoveOpening: (id: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  onPrint?: () => void;
  printLabel?: string;
  deals?: Deal[];
  estimateOptions?: EstimateOption[];
  selectedEstimateId?: string;
  onEstimateImport?: (estimateId: string) => void;
  onClientSelect?: (payload: { clientId: string; clientName: string }) => void;
  dealerClientNote?: string;
  labels?: Partial<Record<string, string>>;
}

function text(labels: SharedRFQFormProps['labels'], key: string, fallback: string) {
  return labels?.[key] || fallback;
}

export function SharedRFQForm({
  variant,
  value,
  openings,
  onChange,
  onAddOpening,
  onUpdateOpening,
  onRemoveOpening,
  onSubmit,
  submitLabel,
  onPrint,
  printLabel = 'Print RFQ',
  deals,
  estimateOptions,
  selectedEstimateId,
  onEstimateImport,
  onClientSelect,
  dealerClientNote,
  labels,
}: SharedRFQFormProps) {
  useEffect(() => {
    if (value.buildingStyle !== 'Single Slope' || !value.width || !value.lowSide || !value.highSide) return;
    const width = parseFloat(value.width);
    const lowSide = parseFloat(value.lowSide);
    const highSide = parseFloat(value.highSide);
    if (!width || highSide <= lowSide) return;
    const pitch = `${(((highSide - lowSide) / width) * 12).toFixed(1)}:12`;
    if (pitch !== value.roofPitch) {
      onChange('roofPitch', pitch);
    }
  }, [value.buildingStyle, value.width, value.lowSide, value.highSide, value.roofPitch, onChange]);

  const setLinerMode = (mode: SharedRFQFormValues['liners']) => {
    onChange('liners', mode);
    onChange('linerLocation', mode === 'none' ? '' : mode);
  };

  return (
    <div className={variant === 'internal' ? 'grid lg:grid-cols-2 gap-6' : 'space-y-5'}>
      <div className="space-y-5">
        {variant === 'internal' && estimateOptions && onEstimateImport && (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {text(labels, 'importSource', 'Import Source')}
            </h3>
            <div>
              <Label className="text-xs">{text(labels, 'savedEstimate', 'Saved Estimate')}</Label>
              <Select value={selectedEstimateId || ''} onValueChange={onEstimateImport}>
                <SelectTrigger className="input-blue mt-1"><SelectValue placeholder={text(labels, 'estimatePlaceholder', 'Import an estimate')} /></SelectTrigger>
                <SelectContent>
                  {estimateOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {variant === 'internal' ? (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {text(labels, 'clientJobInfo', 'Client & Job Info')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{text(labels, 'clientName', 'Client Name')}</Label>
                <ClientSelect
                  mode="name"
                  valueId={value.clientId}
                  valueName={value.clientName}
                  onSelect={payload => onClientSelect?.(payload)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{text(labels, 'clientId', 'Client ID')}</Label>
                <ClientSelect
                  mode="id"
                  valueId={value.clientId}
                  valueName={value.clientName}
                  onSelect={payload => onClientSelect?.(payload)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{text(labels, 'jobId', 'Job ID')}</Label>
                <JobIdSelect
                  value={value.jobId}
                  onValueChange={jobId => onChange('jobId', jobId)}
                  deals={deals}
                  allowedStates={['rfq']}
                  placeholder={text(labels, 'jobIdPlaceholder', 'Auto-generated')}
                />
              </div>
              <div>
                <Label className="text-xs">{text(labels, 'jobName', 'Job Name')}</Label>
                <Input className="input-blue mt-1" value={value.jobName} onChange={event => onChange('jobName', event.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{text(labels, 'salesRep', 'Sales Rep')}</Label>
                <PersonnelSelect value={value.salesRep} onValueChange={nextValue => onChange('salesRep', nextValue)} role="sales_rep" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">{text(labels, 'estimator', 'Estimator')}</Label>
                <PersonnelSelect value={value.estimator} onValueChange={nextValue => onChange('estimator', nextValue)} role="estimator" className="mt-1" />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {text(labels, 'clientInfo', 'Client Information')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">{text(labels, 'clientName', 'Client Name')}</Label>
                <Input
                  className="input-blue mt-1"
                  value={value.clientName}
                  onChange={event => onChange('clientName', event.target.value)}
                  placeholder={text(labels, 'clientNamePlaceholder', 'Client / project name')}
                />
              </div>
              <div>
                <Label className="text-xs">{text(labels, 'contactEmail', 'Contact Email')}</Label>
                <Input className="input-blue mt-1" type="email" value={value.contactEmail} onChange={event => onChange('contactEmail', event.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{text(labels, 'contactPhone', 'Contact Phone')}</Label>
                <Input className="input-blue mt-1" value={value.contactPhone} onChange={event => onChange('contactPhone', event.target.value)} />
              </div>
            </div>
            {dealerClientNote ? <p className="text-[10px] text-muted-foreground mt-2">{dealerClientNote}</p> : null}
          </div>
        )}

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {text(labels, 'location', 'Location')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{text(labels, 'province', 'Province')}</Label>
              <Select value={value.province} onValueChange={nextValue => onChange('province', nextValue)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(province => (
                    <SelectItem key={province.code} value={province.code}>
                      {variant === 'dealer' ? `${province.code} - ${province.name}` : province.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{text(labels, 'city', 'City')}</Label>
              <Input className="input-blue mt-1" value={value.city} onChange={event => onChange('city', event.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{text(labels, 'address', 'Address')}</Label>
              <Input className="input-blue mt-1" value={value.address} onChange={event => onChange('address', event.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{text(labels, 'postalCode', 'Postal Code')}</Label>
              <Input className="input-blue mt-1" value={value.postalCode} onChange={event => onChange('postalCode', event.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {text(labels, 'buildingDetails', 'Building Details')}
          </h3>
          <div className="mb-4">
            <Label className="text-xs">{text(labels, 'buildingStyle', 'Building Style')}</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  checked={value.buildingStyle === 'Symmetrical'}
                  onChange={() => onChange('buildingStyle', 'Symmetrical')}
                />
                {text(labels, 'symmetrical', 'Symmetrical')}
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  checked={value.buildingStyle === 'Single Slope'}
                  onChange={() => onChange('buildingStyle', 'Single Slope')}
                />
                {text(labels, 'singleSlope', 'Single Slope')}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div><Label className="text-xs">{text(labels, 'width', 'Width')}</Label><Input className="input-blue mt-1" type="number" value={value.width} onChange={event => onChange('width', event.target.value)} /></div>
            <div><Label className="text-xs">{text(labels, 'length', 'Length')}</Label><Input className="input-blue mt-1" type="number" value={value.length} onChange={event => onChange('length', event.target.value)} /></div>
            {value.buildingStyle === 'Symmetrical' ? (
              <>
                <div><Label className="text-xs">{text(labels, 'height', 'Height')}</Label><Input className="input-blue mt-1" type="number" value={value.height} onChange={event => onChange('height', event.target.value)} /></div>
                <div><Label className="text-xs">{text(labels, 'roofPitch', 'Roof Pitch')}</Label><Input className="input-blue mt-1" value={value.roofPitch} onChange={event => onChange('roofPitch', event.target.value)} placeholder="1:12" /></div>
              </>
            ) : (
              <>
                <div><Label className="text-xs">{text(labels, 'lowSide', 'Low Side')}</Label><Input className="input-blue mt-1" type="number" value={value.lowSide} onChange={event => onChange('lowSide', event.target.value)} /></div>
                <div><Label className="text-xs">{text(labels, 'highSide', 'High Side')}</Label><Input className="input-blue mt-1" type="number" value={value.highSide} onChange={event => onChange('highSide', event.target.value)} /></div>
                <div className="col-span-4 mt-2">
                  <Label className="text-xs block">{text(labels, 'calculatedPitch', 'Calculated Pitch')}</Label>
                  <Input className="input-blue mt-1 bg-muted max-w-[150px]" readOnly value={value.roofPitch} />
                </div>
              </>
            )}
          </div>
        </div>

        {variant === 'dealer' && (
          <RFQOpeningsSection
            title={text(labels, 'openingsTitle', 'Wall Openings')}
            subtitle={text(labels, 'openingsSubtitle', 'Track framed openings by wall for design reference.')}
            openings={openings}
            onAddOpening={onAddOpening}
            onUpdateOpening={onUpdateOpening}
            onRemoveOpening={onRemoveOpening}
            notesPlaceholder={text(labels, 'openingsNotesPlaceholder', 'Door, window, framed opening...')}
          />
        )}
      </div>

      <div className="space-y-5">
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {text(labels, 'accessories', 'Accessories & Notes')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">{text(labels, 'liners', 'Liners')}</Label>
              <Select value={value.liners} onValueChange={nextValue => setLinerMode(nextValue as SharedRFQFormValues['liners'])}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{text(labels, 'liners.none', 'None')}</SelectItem>
                  <SelectItem value="roof">{text(labels, 'liners.roof', 'Roof')}</SelectItem>
                  <SelectItem value="walls">{text(labels, 'liners.walls', 'Walls')}</SelectItem>
                  <SelectItem value="roof_walls">{text(labels, 'liners.roofWalls', 'Roof + Walls')}</SelectItem>
                </SelectContent>
              </Select>
              {value.liners !== 'none' && (
                <div className="mt-3">
                  <Label className="text-xs">{text(labels, 'linerNotes', 'Liner Notes')}</Label>
                  <Textarea className="text-xs mt-1" value={value.linerNotes} onChange={event => onChange('linerNotes', event.target.value)} />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">{text(labels, 'gutters', 'Gutters')}</Label>
              <Select value={value.gutters} onValueChange={nextValue => onChange('gutters', nextValue as SharedRFQFormValues['gutters'])}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{text(labels, 'gutters.none', 'None')}</SelectItem>
                  <SelectItem value="per_side">{text(labels, 'gutters.perSide', 'Specify per side')}</SelectItem>
                  <SelectItem value="spacing">{text(labels, 'gutters.spacing', 'Specify spacing')}</SelectItem>
                </SelectContent>
              </Select>
              {value.gutters === 'per_side' && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">{text(labels, 'downspoutsPerSide', 'Downspouts per side')}</Label>
                  <Input className="input-blue mt-1 h-8" type="number" value={value.guttersPerSide} onChange={event => onChange('guttersPerSide', event.target.value)} />
                </div>
              )}
              {value.gutters === 'spacing' && (
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">{text(labels, 'downspoutsSpacing', 'Downspouts spacing')}</Label>
                  <Input className="input-blue mt-1 h-8" type="number" value={value.guttersSpacing} onChange={event => onChange('guttersSpacing', event.target.value)} />
                </div>
              )}
              {value.gutters !== 'none' && (
                <div className="mt-3">
                  <Label className="text-xs">{text(labels, 'gutterNotes', 'Gutter Notes')}</Label>
                  <Textarea className="text-xs mt-1" value={value.gutterNotes} onChange={event => onChange('gutterNotes', event.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">{text(labels, 'insulationRequired', 'Insulation Required')}</Label>
            <Switch checked={value.insulationRequired} onCheckedChange={nextValue => onChange('insulationRequired', nextValue)} />
          </div>

          {value.insulationRequired && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{text(labels, 'roofGrade', 'Roof Grade')}</Label><Input className="input-blue mt-1" value={value.insulationRoofGrade} onChange={event => onChange('insulationRoofGrade', event.target.value)} /></div>
              <div><Label className="text-xs">{text(labels, 'wallGrade', 'Wall Grade')}</Label><Input className="input-blue mt-1" value={value.insulationWallGrade} onChange={event => onChange('insulationWallGrade', event.target.value)} /></div>
            </div>
          )}
        </div>

        {variant === 'internal' && (
          <RFQOpeningsSection
            title={text(labels, 'openingsTitle', 'Openings')}
            openings={openings}
            onAddOpening={onAddOpening}
            onUpdateOpening={onUpdateOpening}
            onRemoveOpening={onRemoveOpening}
          />
        )}

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {text(labels, 'notes', 'Notes')}
          </h3>
          <Textarea
            className={variant === 'internal' ? 'text-xs min-h-[120px]' : 'text-xs min-h-[100px]'}
            value={value.notes}
            onChange={event => onChange('notes', event.target.value)}
            placeholder={text(labels, 'notesPlaceholder', '')}
          />
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {text(labels, 'actions', 'Actions')}
          </h3>
          <Button onClick={onSubmit} className="w-full" size={variant === 'dealer' ? 'lg' : 'default'}>
            <Send className="h-4 w-4 mr-2" />{submitLabel}
          </Button>
          {onPrint && (
            <Button variant="outline" onClick={onPrint} className="w-full">
              <Printer className="h-4 w-4 mr-2" />{printLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

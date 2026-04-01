export type WallLocation = 'LEW' | 'REW' | 'FSW' | 'BSW';

export interface RFQOpening {
  id: string;
  wall: WallLocation;
  number: number;
  width: string;
  height: string;
  notes: string;
}

export const WALL_LABELS: Record<WallLocation, string> = {
  LEW: 'Left End Wall',
  REW: 'Right End Wall',
  FSW: 'Front Side Wall',
  BSW: 'Back Side Wall',
};

export const createOpening = (wall: WallLocation, currentOpenings: RFQOpening[]): RFQOpening => ({
  id: crypto.randomUUID(),
  wall,
  number: currentOpenings.filter(opening => opening.wall === wall).length + 1,
  width: '',
  height: '',
  notes: '',
});

export const renumberOpenings = (openings: RFQOpening[]) =>
  openings.map(opening => ({
    ...opening,
    number: openings.filter(item => item.wall === opening.wall).findIndex(item => item.id === opening.id) + 1,
  }));

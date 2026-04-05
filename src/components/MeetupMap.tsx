import { ExternalLink } from 'lucide-react';

type MeetupMapProps = {
  locationName?: string;
  address?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  compact?: boolean;
};

const toFiniteNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function MeetupMap({ locationName, address, latitude, longitude, compact = false }: MeetupMapProps) {
  const label = String(locationName || '').trim();
  if (!label) {
    return null;
  }

  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  const hasCoordinates = lat !== null && lng !== null;
  const mapTarget = hasCoordinates ? `${lat},${lng}` : String(address || label).trim();
  const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapTarget)}&z=15&output=embed`;
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapTarget)}`;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/70">
        <iframe
          title={`Map preview for ${label}`}
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className={`w-full border-0 ${compact ? 'h-52' : 'h-60'}`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hasCoordinates ? `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Map based on selected pickup point'}
        </p>
        <a
          href={directionsHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Open in Google Maps
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}


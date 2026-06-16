import { Card, CardContent } from '@/app/components/ui/card';
import { MapPin, Heart, Star, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { normalizeImageUrl } from '@/lib/images';
import { ResilientImage } from '@/components/ResilientImage';
import { useAutoTranslate } from '@/hooks/useAutoTranslate';
import { cn } from '@/app/components/ui/utils';

// ── Shared ProductCard ───────────────────────────────────────────────────────
// Token-based marketplace card. Used by Marketplace, Home and ItemDetails.
// Behaviour (save toggle, navigation, auto-translate) is unchanged from the
// original inline card in Marketplace.tsx.
export function ProductCard({
  item, isSaved, onSave, onNavigate, t, formatCurrency, resolveLocationLabel, variant = 'default',
}: {
  item: any;
  isSaved: boolean;
  onSave: (id: string) => void;
  onNavigate: () => void;
  t: (key: string, fallback?: string) => string;
  formatCurrency: (n: number) => string;
  resolveLocationLabel: (item: any) => string;
  variant?: 'default' | 'market';
}) {
  const isMarket = variant === 'market';
  const { translated, isTranslating } = useAutoTranslate([
    item.title || '',
    item.description || '',
  ]);
  const [translatedTitle] = translated;
  const primaryImage = normalizeImageUrl(item.images?.[0]);
  const seller = item.seller || null;

  const conditionLabel = String(item.condition || '')
    .trim()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
  const badgeLabel =
    conditionLabel || (item.type === 'rent' ? t('marketplace.rent', 'Rent') : t('marketplace.buy', 'Buy'));
  const isVerified = Boolean(seller?.isVerified || seller?.university);

  return (
    <Card
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-elevated"
      onClick={onNavigate}
    >
      {/* ── Image ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F7F9F8]">
        {primaryImage ? (
          <ResilientImage
            src={primaryImage}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            fallback={
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
              </div>
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Condition / type badge — top left */}
        <div
          className={cn(
            'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm',
            isMarket ? 'bg-primary-soft text-primary-strong' : 'bg-primary text-primary-foreground',
          )}
        >
          {badgeLabel}
        </div>

        {/* Heart button — top right */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSave(item.id); }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/95 shadow-md transition-all duration-200 hover:scale-110 hover:bg-card"
          aria-label={isSaved ? 'Remove from favorites' : 'Save item'}
        >
          <Heart
            className={cn(
              'h-4 w-4 transition-colors',
              isSaved ? 'fill-destructive text-destructive' : 'text-muted-foreground',
            )}
          />
        </button>
      </div>

      {/* ── Body ── */}
      <CardContent className="flex flex-1 flex-col gap-1 px-4 pb-3 pt-2.5">
        {/* Verified student micro-label (market variant) */}
        {isMarket && isVerified ? (
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
            <ShieldCheck className="h-3 w-3" />
            {t('marketplace.verifiedStudent', 'Verified Student')}
          </p>
        ) : null}

        {/* Title */}
        <h3
          className={cn(
            'line-clamp-1 text-sm font-semibold leading-snug text-foreground',
            isTranslating && 'opacity-50',
          )}
        >
          {translatedTitle || item.title}
        </h3>

        {/* Seller university / location */}
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">{resolveLocationLabel(item)}</span>
        </p>

        {/* Price */}
        <p className="mt-1 text-base font-extrabold text-primary">
          {formatCurrency(item.price)}
        </p>

        {/* Rating (default variant only) */}
        {!isMarket && seller?.rating ? (
          <div className="mt-auto flex items-center gap-1.5 pt-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-foreground">{Number(seller.rating).toFixed(1)}</span>
            {seller.reviewCount ? (
              <span className="text-xs text-muted-foreground">({seller.reviewCount})</span>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      {/* ── Seller row (market variant) ── */}
      {isMarket ? (
        <div className="mt-auto flex items-center justify-between border-t border-border px-4 pb-3 pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-primary-soft">
              {seller?.profilePicture || seller?.avatar ? (
                <img
                  src={seller.profilePicture || seller.avatar}
                  alt={seller?.name || 'Seller'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-primary">
                  {(seller?.name || 'S').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="truncate text-xs font-semibold text-foreground">
              {seller?.name || t('marketplace.unknownSeller', 'Seller')}
            </span>
          </div>
          {seller?.rating ? (
            <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {Number(seller.rating).toFixed(1)}
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

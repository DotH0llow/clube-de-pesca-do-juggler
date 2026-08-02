import type { CSSProperties } from 'react';
import { asset } from '../assets';
import type { FishSpecies, JunkItem } from '../state/types';

interface SpriteProps {
  path: string;
  alt?: string;
  /** altura maxima em px */
  size?: number;
  className?: string;
  style?: CSSProperties;
  flip?: boolean;
}

/** Qualquer sprite do kit, ja recortado e em webp. */
export function Sprite({ path, alt = '', size = 64, className, style, flip }: SpriteProps) {
  return (
    <img
      className={`sprite${className ? ` ${className}` : ''}`}
      src={asset(path)}
      alt={alt}
      draggable={false}
      style={{
        maxHeight: size,
        maxWidth: '100%',
        transform: flip ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    />
  );
}

interface FishProps {
  fish: FishSpecies;
  size?: number;
  className?: string;
  flip?: boolean;
  style?: CSSProperties;
}

/**
 * Sprite de peixe. As criaturas da Hydra nunca aparecem nitidas: viram
 * silhueta com brilho vermelho, que e exatamente o que a lenda diz.
 */
export function FishSprite({ fish, size = 96, className, flip, style }: FishProps) {
  return (
    <Sprite
      path={fish.sprite}
      alt={fish.name}
      size={size}
      flip={flip}
      className={`${fish.silhouette ? 'sprite-silhouette ' : ''}${className ?? ''}`.trim()}
      style={style}
    />
  );
}

export function JunkSprite({ junk, size = 96 }: { junk: JunkItem; size?: number }) {
  return <Sprite path={junk.sprite} alt={junk.name} size={size} />;
}

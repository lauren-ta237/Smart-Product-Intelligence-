import type { ProductCoordinates } from "../../types/products.ts";

interface Props {
  box: ProductCoordinates;
}

export default function BoundingBox({ box }: Props) {
  // 🟢 1. Safety Guard: If box doesn't exist, draw nothing
  if (!box) return null;

  // 🟢 2. Normalize: If it's a nested array [[ymin, xmin, ymax, xmax]], grab the first one. 
  // Otherwise, use it directly as a flat array.
  const flatBox = Array.isArray(box[0]) 
    ? (box[0] as number[]) 
    : (box as number[]);

  // 🟢 3. Secondary Guard: Make sure we have our 4 core values
  if (flatBox.length < 4) return null;

  // 🟢 4. Now we use flatBox safely! TypeScript won't complain here anymore.
  const isNormalizedByThousand = Math.max(...flatBox) > 1;

  const ymin = isNormalizedByThousand ? flatBox[0] / 1000 : flatBox[0];
  const xmin = isNormalizedByThousand ? flatBox[1] / 1000 : flatBox[1];
  const ymax = isNormalizedByThousand ? flatBox[2] / 1000 : flatBox[2];
  const xmax = isNormalizedByThousand ? flatBox[3] / 1000 : flatBox[3];

  // Calculate percentage spatial gaps for CSS overlays
  const left = `${xmin * 100}%`;
  const top = `${ymin * 100}%`;
  const width = `${(xmax - xmin) * 100}%`;
  const height = `${(ymax - ymin) * 100}%`;

  return (
    <div
      className="absolute border-2 border-red-500 bg-red-50/10 pointer-events-none rounded-sm transition-all duration-300"
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  );
}
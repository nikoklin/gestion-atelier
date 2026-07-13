import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Pen } from "lucide-react";

interface SignaturePadProps {
  value?: string | null;
  onChange?: (dataUrl: string | null) => void;
  readOnly?: boolean;
  width?: number;
  height?: number;
}

export default function SignaturePad({
  value,
  onChange,
  readOnly = false,
  width = 400,
  height = 160,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Charger la signature existante dans le canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPoint.current = getPos(e, canvas);
  }, [readOnly]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentPoint = getPos(e, canvas);
    const from = lastPoint.current || currentPoint;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPoint.current = currentPoint;
    setIsEmpty(false);
  }, [isDrawing, readOnly]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPoint.current = null;

    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    onChange(canvas.toDataURL("image/png"));
  }, [isDrawing, onChange]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    if (onChange) onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative border-2 rounded-lg overflow-hidden bg-white ${
          readOnly
            ? "border-border"
            : "border-dashed border-muted-foreground/40 hover:border-primary/60 transition-colors"
        }`}
        style={{ width: "100%", maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block w-full touch-none"
          style={{ cursor: readOnly ? "default" : "crosshair" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {isEmpty && !readOnly && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-muted-foreground/50 text-sm">
              <Pen className="w-4 h-4" />
              <span>Dessinez votre signature ici</span>
            </div>
          </div>
        )}
        {isEmpty && readOnly && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground/50 text-sm italic">Aucune signature</span>
          </div>
        )}
      </div>
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSignature}
          disabled={isEmpty}
          className="self-start"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          Effacer
        </Button>
      )}
    </div>
  );
}

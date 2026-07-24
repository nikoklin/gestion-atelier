import { useEffect, useRef } from "react";
import { Bold, Italic, Link as LinkIcon } from "lucide-react";

type SimpleHtmlEditorProps = {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Éditeur visuel minimal (gras, italique, lien) pour les corps de message
 * HTML — l'utilisateur voit un rendu mis en forme, jamais les balises brutes.
 * Le contenu stocké/chargé reste du HTML (compatible avec les templates
 * existants), y compris les variables littérales du type {{firstName}}.
 */
export function SimpleHtmlEditor({ id, value, onChange, placeholder, className }: SimpleHtmlEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Ne réinjecte le HTML que lorsqu'il diffère du DOM réel (ex: chargement
  // initial du template, ou remount après changement d'onglet) — jamais
  // pendant la frappe, sinon le curseur saute au début à chaque caractère.
  // On compare au DOM réel (pas à une ref séparée) car au remount d'un
  // composant existant une ref initialisée avec `value` masquerait le fait
  // que le nouveau <div> est, lui, encore vide.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (!ref.current) return;
    onChange(ref.current.innerHTML);
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleLink = () => {
    const url = window.prompt("Adresse du lien (https://...)");
    if (url) exec("createLink", url);
  };

  const isEmpty = !value || value.trim() === "";

  return (
    <div className={`border rounded-md bg-background ${className ?? ""}`}>
      <div className="flex gap-1 border-b p-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          className="p-1.5 rounded hover:bg-muted"
          title="Gras"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("italic")}
          className="p-1.5 rounded hover:bg-muted"
          title="Italique"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          className="p-1.5 rounded hover:bg-muted"
          title="Insérer un lien"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="pointer-events-none absolute top-3 left-3 text-sm text-muted-foreground whitespace-pre-line">
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          id={id}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className="min-h-[200px] p-3 text-sm focus:outline-none"
        />
      </div>
    </div>
  );
}

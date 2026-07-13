import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * Détecte si l'écran est en mode paysage mobile :
 * hauteur < 500px ET orientation paysage (largeur > hauteur)
 */
export function useIsMobileLandscape() {
  const [isLandscape, setIsLandscape] = React.useState<boolean>(false);

  React.useEffect(() => {
    const check = () => {
      setIsLandscape(
        window.innerHeight < 500 && window.innerWidth > window.innerHeight
      );
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  return isLandscape;
}

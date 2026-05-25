let pageScrollLockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedHtmlOverscrollBehavior = "";

export function lockPageScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  pageScrollLockCount += 1;
  if (pageScrollLockCount > 1) return;
  savedBodyOverflow = document.body.style.overflow;
  savedBodyPaddingRight = document.body.style.paddingRight;
  savedHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  document.documentElement.style.overscrollBehavior = "contain";
}

export function unlockPageScroll(): void {
  if (typeof document === "undefined" || pageScrollLockCount === 0) return;
  pageScrollLockCount -= 1;
  if (pageScrollLockCount > 0) return;
  document.body.style.overflow = savedBodyOverflow;
  document.body.style.paddingRight = savedBodyPaddingRight;
  document.documentElement.style.overscrollBehavior = savedHtmlOverscrollBehavior;
}

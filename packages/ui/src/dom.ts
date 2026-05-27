let pageScrollLockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedBodyPosition = "";
let savedBodyTop = "";
let savedBodyWidth = "";
let savedHtmlOverscrollBehavior = "";
let savedScrollY = 0;

export function lockPageScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  pageScrollLockCount += 1;
  if (pageScrollLockCount > 1) return;
  savedBodyOverflow = document.body.style.overflow;
  savedBodyPaddingRight = document.body.style.paddingRight;
  savedBodyPosition = document.body.style.position;
  savedBodyTop = document.body.style.top;
  savedBodyWidth = document.body.style.width;
  savedHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.width = "100%";
  if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  document.documentElement.style.overscrollBehavior = "contain";
}

export function unlockPageScroll(): void {
  if (typeof window === "undefined" || typeof document === "undefined" || pageScrollLockCount === 0) return;
  pageScrollLockCount -= 1;
  if (pageScrollLockCount > 0) return;
  document.body.style.overflow = savedBodyOverflow;
  document.body.style.paddingRight = savedBodyPaddingRight;
  document.body.style.position = savedBodyPosition;
  document.body.style.top = savedBodyTop;
  document.body.style.width = savedBodyWidth;
  document.documentElement.style.overscrollBehavior = savedHtmlOverscrollBehavior;
  window.scrollTo(0, savedScrollY);
  savedScrollY = 0;
}

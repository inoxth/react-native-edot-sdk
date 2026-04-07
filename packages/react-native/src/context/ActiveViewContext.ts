import type { SpanContext } from '../types';

let activeViewContext: SpanContext | null = null;
let activeViewName: string | null = null;

export function setActiveView(spanContext: SpanContext, viewName: string): void {
  activeViewContext = spanContext;
  activeViewName = viewName;
}

export function clearActiveView(): void {
  activeViewContext = null;
  activeViewName = null;
}

export function getActiveViewContext(): SpanContext | null {
  return activeViewContext;
}

export function getActiveViewName(): string | null {
  return activeViewName;
}

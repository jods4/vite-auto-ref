import type { UnwrapRef } from "vue";

interface Auto {
  <T>(value: T): UnwrapRef<T>;
  ref<T>(value: T): T;
  ref<T = any>(): T | undefined;
  computed<T>(getter: () => T): T;
  computed<T>(options: { get(): T, set(value: T): void }): T;
}

export const auto: Auto;
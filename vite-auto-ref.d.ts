import type { computed, ref, UnwrapRef } from "vue";
  
interface Auto {
  <T>(x: T): UnwrapRef<T>;
  ref: typeof ref;
  computed: typeof computed;
}

export const auto: Auto;
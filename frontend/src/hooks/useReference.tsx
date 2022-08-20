// 👇 React
import { useRef } from "react";

// 👇 wrapper for react useRef
export const useReference = <T,>(value: T) => {
  const ref = useRef<T>(value);

  const res = {
    value: ref.current,
    update: (value: T) => {
      ref.current = res.value = value;
    },
  };

  return res;
};

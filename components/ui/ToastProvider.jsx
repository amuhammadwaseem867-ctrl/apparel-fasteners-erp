"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Toast from "./Toast";
import "./Toast.css";

const ToastContext =
  createContext(null);

const missingProviderToast = (action) => () => {
  console.error(
    `Cannot ${action}: ToastProvider is not mounted.`
  );
  return null;
};

const MISSING_TOAST_CONTEXT = {
  toast: missingProviderToast("show a toast"),
  success: missingProviderToast("show a success toast"),
  error: missingProviderToast("show an error toast"),
  warning: missingProviderToast("show a warning toast"),
  info: missingProviderToast("show an info toast"),
  remove: missingProviderToast("remove a toast"),
  clear: missingProviderToast("clear toasts"),
};

function createToastId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function ToastProvider({
  children,
  maxToasts = 5,
}) {
  const [toasts, setToasts] =
    useState([]);
  const timers = useRef(new Map());

  useEffect(
    () => () => {
      timers.current.forEach((timer) =>
        window.clearTimeout(timer)
      );
      timers.current.clear();
    },
    []
  );

  const removeToast = useCallback(
    (id) => {
      const timer = timers.current.get(id);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timers.current.delete(id);
      }

      setToasts((current) =>
        current.filter(
          (toast) => toast.id !== id
        )
      );
    },
    []
  );

  const addToast = useCallback(
    ({
      type = "info",
      title,
      message,
      duration = 5000,
    }) => {
      const id = createToastId();

      setToasts((current) => {
        const next = [
          ...current,
          {
            id,
            type,
            title,
            message,
            duration,
          },
        ];

        return next.slice(-maxToasts);
      });

      if (duration > 0) {
        const timer = window.setTimeout(() => {
          timers.current.delete(id);
          removeToast(id);
        }, duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [maxToasts, removeToast]
  );

  const success = useCallback(
    (options) =>
      addToast({
        ...options,
        type: "success",
      }),
    [addToast]
  );

  const error = useCallback(
    (options) =>
      addToast({
        ...options,
        type: "error",
      }),
    [addToast]
  );

  const warning = useCallback(
    (options) =>
      addToast({
        ...options,
        type: "warning",
      }),
    [addToast]
  );

  const info = useCallback(
    (options) =>
      addToast({
        ...options,
        type: "info",
      }),
    [addToast]
  );

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  const value = useMemo(
    () => ({
      toast: addToast,
      success,
      error,
      warning,
      info,
      remove: removeToast,
      clear,
    }),
    [
      addToast,
      success,
      error,
      warning,
      info,
      removeToast,
      clear,
    ]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="erp-toast-container"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context =
    useContext(ToastContext);

  return context || MISSING_TOAST_CONTEXT;
}
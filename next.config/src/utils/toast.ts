'use client';

import { cssTransition, toast, type ToastOptions } from 'react-toastify';
export const slideBottom = cssTransition({
  enter: 'toast-slide-in-up',
  exit: 'toast-slide-out-down',
  collapseDuration: 250,
});

const baseOptions: ToastOptions = {
  position: 'bottom-center',
  autoClose: 2000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  transition: slideBottom,
  theme: 'dark',
  style: { textAlign: 'center' },
};


export const showToast = {
  success: (message: string, options?: ToastOptions) =>
    toast.success(message, { ...baseOptions, ...options }),
  error: (message: string, options?: ToastOptions) =>
    toast.error(message, { ...baseOptions, ...options }),
  info: (message: string, options?: ToastOptions) =>
    toast.info(message, { ...baseOptions, ...options }),
  warning: (message: string, options?: ToastOptions) =>
    toast.warning(message, { ...baseOptions, ...options }),
  default: (message: string, options?: ToastOptions) =>
    toast(message, { ...baseOptions, ...options }),
  dismiss: toast.dismiss,
};

export { toast };

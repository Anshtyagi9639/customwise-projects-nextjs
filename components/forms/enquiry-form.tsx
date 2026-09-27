"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useForm, type FieldError } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { submitEnquiry } from "@/lib/enquiry/actions";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils/cn";
import {
  enquirySchema,
  enquiryServices,
  type EnquiryFormValues,
  type EnquiryInput,
} from "@/lib/validation/enquiry";
import type { EnquiryServiceValue } from "@/types";

type EnquiryFormProps = { idPrefix: string; defaultService?: EnquiryServiceValue };

const inputClass =
  "block min-h-12 w-full rounded-[5px] border-[1.5px] border-line bg-salt px-3 py-2.5 text-base text-overnight placeholder:text-pebble focus:border-atlantic focus:outline-none focus:ring-3 focus:ring-atlantic/25 aria-[invalid=true]:border-error";

const NETWORK_ERROR = "We couldn't reach the server. Please check your connection and try again.";

export function EnquiryForm({ idPrefix, defaultService }: EnquiryFormProps) {
  const uid = useId();
  const id = (name: string) => `${idPrefix}-${name}-${uid}`;
  const [errorMessage, setErrorMessage] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);

  const defaultValues = {
    name: "",
    company: "",
    email: "",
    phone: "",
    service: defaultService,
    message: "",
    website: "",
  } as EnquiryFormValues;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryFormValues, unknown, EnquiryInput>({
    resolver: zodResolver(enquirySchema),
    mode: "onTouched",
    defaultValues,
  });

  const onSubmit = async (values: EnquiryInput) => {
    setErrorMessage("");

    let result: Awaited<ReturnType<typeof submitEnquiry>>;
    try {
      result = await submitEnquiry(values);
    } catch {
      setErrorMessage(NETWORK_ERROR);
      return;
    }

    if (result.ok) {
      reset(defaultValues); // clear the form
      setSuccessOpen(true); // show the success popup
      return;
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof EnquiryInput, { message }, { shouldFocus: true });
      }
    }
    setErrorMessage(result.message);
  };

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-labelledby={id("title")}
        className="relative rounded-brand border border-line bg-salt p-5.5 text-overnight sm:p-9"
      >
        <h3 id={id("title")} className="text-[1.6rem]">
          Enquiry form
        </h3>
        <p className="mt-1 text-[0.93rem] text-ink-soft">Fields marked optional can be left blank.</p>

        <div className="mt-5 grid gap-x-4.5 gap-y-4 sm:grid-cols-2">
          <Field id={id("name")} label="Name" error={errors.name}>
            <input id={id("name")} autoComplete="name" className={inputClass} {...a11y(id("name"), errors.name)} {...register("name")} />
          </Field>
          <Field id={id("company")} label="Company" optional error={errors.company}>
            <input id={id("company")} autoComplete="organization" className={inputClass} {...a11y(id("company"), errors.company)} {...register("company")} />
          </Field>
          <Field id={id("email")} label="Email" error={errors.email}>
            <input id={id("email")} type="email" autoComplete="email" inputMode="email" className={inputClass} {...a11y(id("email"), errors.email)} {...register("email")} />
          </Field>
          <Field id={id("phone")} label="Phone" optional error={errors.phone}>
            <input id={id("phone")} type="tel" autoComplete="tel" className={inputClass} {...a11y(id("phone"), errors.phone)} {...register("phone")} />
          </Field>
          <Field id={id("service")} label="What do you need help with?" error={errors.service} className="sm:col-span-2">
            {/* No separate defaultValue: react-hook-form's defaultValues controls it, so reset() works */}
            <select id={id("service")} className={inputClass} {...a11y(id("service"), errors.service)} {...register("service")}>
              <option value="" disabled>
                Choose a service
              </option>
              {enquiryServices.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={id("message")} label="Tell us about your goods and route" error={errors.message} className="sm:col-span-2">
            <textarea
              id={id("message")}
              rows={5}
              placeholder="For example: chilled beef from Argentina into Dublin Port, weekly, container"
              className={cn(inputClass, "min-h-32 resize-y")}
              {...a11y(id("message"), errors.message)}
              {...register("message")}
            />
          </Field>
          {/* Honeypot: visually hidden and skipped by keyboard and screen readers */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={id("website")}>Leave this field empty</label>
            <input id={id("website")} tabIndex={-1} autoComplete="off" {...register("website")} />
          </div>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-5 rounded-r-[5px] border-l-4 border-error bg-mist px-4 py-3 text-[0.95rem] font-semibold text-error">
            {errorMessage}
          </p>
        )}

        <Button type="submit" className="mt-5" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 aria-hidden className="animate-spin" /> Sending...
            </>
          ) : (
            <>
              Send enquiry <ArrowRight aria-hidden />
            </>
          )}
        </Button>
        <p className="mt-4 text-[0.84rem] text-ink-soft">
          We use your details only to reply to this enquiry. Read our{" "}
          <a href={site.privacyPolicy} target="_blank" rel="noopener noreferrer" className="text-atlantic underline underline-offset-3">
            privacy policy<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </form>

      {/* Success popup */}
      <Dialog.Root open={successOpen} onOpenChange={setSuccessOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-overnight/70 backdrop-blur-sm data-[state=open]:animate-menu-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-brand bg-salt p-7 text-center text-overnight shadow-2xl focus:outline-none data-[state=open]:animate-menu-in sm:p-9">
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-mist"
              >
                <X aria-hidden className="size-5" />
              </button>
            </Dialog.Close>

            <CheckCircle2 aria-hidden className="mx-auto size-14 text-transit" />
            <Dialog.Title className="mt-4 text-[1.6rem]">Enquiry submitted successfully</Dialog.Title>
            <Dialog.Description className="mt-2 text-ink-soft">
              Thank you for contacting Customs Wise. Your enquiry has been received and our team will get back to you shortly.
            </Dialog.Description>

            <Dialog.Close asChild>
              <Button className="mt-6 w-full sm:w-auto">OK</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function a11y(fieldId: string, error?: FieldError) {
  return { "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${fieldId}-error` : undefined };
}

function Field({
  id,
  label,
  optional,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: FieldError;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.9rem] font-semibold">
        {label} {optional && <span className="font-normal text-pebble">(optional)</span>}
      </label>
      {children}
      {error?.message && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.85rem] font-semibold text-error">
          {error.message}
        </p>
      )}
    </div>
  );
}
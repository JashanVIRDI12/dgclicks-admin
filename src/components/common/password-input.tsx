"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * Password field with a reveal toggle.
 *
 * Built on `InputGroup` rather than absolutely positioning a button over an
 * `Input`: the group already owns the focus ring, the `aria-invalid` border and
 * the disabled state, so the toggle sits inside the control instead of on top
 * of it and none of that styling has to be restated here.
 *
 * `type` is deliberately not accepted — the whole point of the component is
 * that it owns the password/text swap. Everything else passes through, so
 * `register()`'s ref, `autoComplete` and `aria-invalid` reach the real input
 * untouched and React Hook Form sees a plain uncontrolled field.
 *
 * Visibility is local and starts off. It is intentionally not lifted or
 * persisted: a revealed password that survives a remount is a shoulder-surfing
 * hazard on a shared screen, and the state means nothing to the form.
 */
export function PasswordInput({
  disabled,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        type={isVisible ? "text" : "password"}
        disabled={disabled}
        {...props}
      />
      {/*
        Rendered after the input so the tab order runs field → toggle, and
        `align="inline-end"` moves it to the right visually without reordering
        the DOM. `InputGroupButton` defaults to `type="button"`, which is what
        keeps a click on the eye from submitting the form.
      */}
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          disabled={disabled}
          onClick={() => setIsVisible((visible) => !visible)}
          aria-pressed={isVisible}
          aria-label={isVisible ? "Hide password" : "Show password"}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

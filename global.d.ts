/// <reference types="@testing-library/jest-dom" />

declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(className: string): R;
    toBeVisible(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeChecked(): R;
    toHaveValue(value: string | number): R;
    toHaveTextContent(text: string | RegExp): R;
    toContainHTML(html: string): R;
    toHaveStyle(style: string | Record<string, any>): R;
    toHaveFocus(): R;
    toBeRequired(): R;
    toBeInvalid(): R;
    toBeValid(): R;
  }
}
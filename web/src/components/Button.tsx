import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "success" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  title?: string;
  id?: string;
  style?: React.CSSProperties;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  type = "button",
  title,
  id,
  style,
}: ButtonProps) {
  const sizeClass = size === "sm" ? "btn-sm" : "";
  const variantClass = `btn-${variant}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      title={title}
      id={id}
      style={style}
    >
      {children}
    </button>
  );
}

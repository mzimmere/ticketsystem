interface AvatarProps {
  name: string | null;
  avatarUrl: string | null;
  groesse?: "sm" | "md" | "lg";
}

const GROESSEN = {
  sm: "h-6 w-6 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-16 w-16 text-lg",
};

export default function Avatar({ name, avatarUrl, groesse = "sm" }: AvatarProps) {
  const initialen = (name ?? "?")
    .split(" ")
    .map((teil) => teil[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "Profilbild"}
        className={`${GROESSEN[groesse]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${GROESSEN[groesse]} flex items-center justify-center rounded-full bg-[var(--bg-muted)] font-medium text-[var(--text-soft)]`}
    >
      {initialen}
    </div>
  );
}

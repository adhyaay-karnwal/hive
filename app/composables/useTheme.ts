const isDark = useDark({
  selector: "html",
  attribute: "class",
  valueDark: "",
  valueLight: "light",
});

export const useTheme = () => {
  const toggleTheme = useToggle(isDark);
  return { isDark, toggleTheme };
};

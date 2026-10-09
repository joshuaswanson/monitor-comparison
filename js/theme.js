const systemPrefersDark = matchMedia("(prefers-color-scheme: dark)");

function themeChoice() {
  return localStorage.getItem("theme") || "system";
}

function applyTheme() {
  const choice = themeChoice();
  const dark =
    choice === "dark" || (choice === "system" && systemPrefersDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll("#themeSwitch button").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeChoice === choice),
    );
  });
}

document.querySelectorAll("#themeSwitch button").forEach((button) => {
  button.addEventListener("click", () => {
    localStorage.setItem("theme", button.dataset.themeChoice);
    applyTheme();
  });
});

systemPrefersDark.addEventListener("change", applyTheme);

applyTheme();

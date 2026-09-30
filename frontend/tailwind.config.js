export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Schibsted Grotesk"', "system-ui", "sans-serif"] },
      colors: {
        ink: "#10302E",
        paper: "#F3F6F5",
        rule: "#D5DEDB",
        saffron: "#E39A1B",
        good: "#2F8F6B",
        risk: "#C8452F",
      },
    },
  },
  plugins: [],
};

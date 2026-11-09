(function (root) {
  const config = {
    Farol: {
      6: { A: { shift: "Manhã", groups: 9 }, B: { shift: "Manhã", groups: 8 } },
      7: { A: { shift: "Manhã", groups: 9 } },
    },
    Jatiúca: {
      6: {
        A: { shift: "Manhã", groups: 10 },
        B: { shift: "Manhã", groups: 10 },
        C: { shift: "Manhã", groups: 11 },
        D: { shift: "Tarde", groups: 12 },
        E: { shift: "Tarde", groups: 10 },
      },
      7: {
        A: { shift: "Manhã", groups: 9 },
        B: { shift: "Manhã", groups: 10 },
        C: { shift: "Tarde", groups: 9 },
        D: { shift: "Tarde", groups: 10 },
      },
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = config;
  else root.SCHOOL_CONFIG = config;
})(typeof window === "undefined" ? globalThis : window);

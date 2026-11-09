module.exports = function handler(req, res) {
  return res
    .status(410)
    .json({
      error:
        "Este endpoint pertence ao formulário anterior. Use a avaliação individual do segundo semestre.",
    });
};

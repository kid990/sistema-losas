const { Router } = require("express");
const reniecController = require("./reniec.controller");
const router = Router();

router.get("/:dni", reniecController.consultarDNI);

module.exports = router;

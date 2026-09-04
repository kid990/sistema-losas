const axios = require("axios");
const { env } = require("../../config/env");

async function consultarDNI(req, res) {
  try {
    const { dni } = req.params;
    const token = env.RENIEC_API_TOKEN;
    const apiUrl = env.RENIEC_API_URL;

    if (!token || !apiUrl) {
      return res.status(500).json({ message: "RENIEC API no configurada" });
    }

    const response = await axios.post(apiUrl, { token, type_document: "dni", document_number: dni },
      { headers: { "Content-Type": "application/json" } }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error consultando DNI:", error.response?.data || error.message);
    res.status(500).json({ message: "Error consultando DNI", error: error.response?.data || error.message });
  }
}

module.exports = { consultarDNI };

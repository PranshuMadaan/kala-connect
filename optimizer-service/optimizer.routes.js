
const express = require("express");
const multer = require("multer");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

const OPTIMIZER_URL =
    process.env.OPTIMIZER_URL || "http://localhost:8000";

// POST /api/optimizer/candidates
router.post(
    "/candidates",
    upload.single("video"),
    async (req, res) => {

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload a product video."
                });
            }

            const formData = new FormData();

            formData.append(
                "video",
                new Blob([req.file.buffer], {
                    type: req.file.mimetype
                }),
                req.file.originalname
            );

            formData.append(
                "pool_size",
                req.body.pool_size || "80"
            );

            formData.append(
                "sample_fps",
                req.body.sample_fps || "10"
            );

            const response = await fetch(
                `${OPTIMIZER_URL}/api/v1/candidates`,
                {
                    method: "POST",
                    body: formData
                }
            );

            const result = await response.json();

            if (!response.ok) {
                return res.status(response.status).json({
                    success: false,
                    message: result.detail || "Optimization failed."
                });
            }

            // Convert relative image paths to accessible URLs.
            result.candidates = result.candidates.map(candidate => ({
                ...candidate,
                image_url: `${OPTIMIZER_URL}${candidate.image_url}`
            }));

            return res.status(200).json(result);

        } catch (error) {

            console.error("Optimizer API error:", error);

            return res.status(502).json({
                success: false,
                message: "Image optimization service is unavailable."
            });
        }
    }
);

module.exports = router;

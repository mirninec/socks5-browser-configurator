function createIconImageData(enabled, size) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");

    const scale = size / 128;

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = enabled ? "#16a34a" : "#9ca3af";
    roundRect(ctx, 0, 0, size, size, 28 * scale);
    ctx.fill();

    // Proxy chain / cable
    ctx.lineWidth = 12 * scale;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.moveTo(36 * scale, 70 * scale);
    ctx.bezierCurveTo(
        36 * scale,
        54.536 * scale,
        48.536 * scale,
        42 * scale,
        64 * scale,
        42 * scale
    );
    ctx.lineTo(76 * scale, 42 * scale);
    ctx.bezierCurveTo(
        91.464 * scale,
        42 * scale,
        104 * scale,
        54.536 * scale,
        104 * scale,
        70 * scale
    );
    ctx.bezierCurveTo(
        104 * scale,
        85.464 * scale,
        91.464 * scale,
        98 * scale,
        76 * scale,
        98 * scale
    );
    ctx.lineTo(64 * scale, 98 * scale);
    ctx.stroke();

    if (enabled) {
        // Inner greenish link
        ctx.lineWidth = 8 * scale;
        ctx.strokeStyle = "#dcfce7";
        ctx.beginPath();
        ctx.moveTo(92 * scale, 70 * scale);
        ctx.bezierCurveTo(
            92 * scale,
            78.837 * scale,
            84.837 * scale,
            86 * scale,
            76 * scale,
            86 * scale
        );
        ctx.lineTo(64 * scale, 86 * scale);
        ctx.stroke();
    }

    // White status circle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(40 * scale, 70 * scale, 18 * scale, 0, Math.PI * 2);
    ctx.fill();

    if (enabled) {
        // Check mark
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 6 * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(32 * scale, 70 * scale);
        ctx.lineTo(38 * scale, 76 * scale);
        ctx.lineTo(50 * scale, 62 * scale);
        ctx.stroke();
    } else {
        // Cross
        ctx.strokeStyle = "#6b7280";
        ctx.lineWidth = 6 * scale;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(32 * scale, 62 * scale);
        ctx.lineTo(48 * scale, 78 * scale);
        ctx.moveTo(48 * scale, 62 * scale);
        ctx.lineTo(32 * scale, 78 * scale);
        ctx.stroke();

        // Diagonal disabled line
        ctx.strokeStyle = "#4b5563";
        ctx.lineWidth = 10 * scale;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(28 * scale, 104 * scale);
        ctx.lineTo(100 * scale, 32 * scale);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // SOCKS text
    if (size >= 48) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${18 * scale}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SOCKS", 64 * scale, 23 * scale);
    }

    return ctx.getImageData(0, 0, size, size);
}

function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

async function updateActionIcon() {
    const data = await chrome.storage.local.get("socks5switch");
    const enabled = (data.socks5switch || "off") === "on";

    const imageData = {
        16: createIconImageData(enabled, 16),
        32: createIconImageData(enabled, 32),
        48: createIconImageData(enabled, 48),
        128: createIconImageData(enabled, 128)
    };

    await chrome.action.setIcon({
        imageData
    });

    await chrome.action.setTitle({
        title: enabled ? "Socks5 Proxy: On" : "Socks5 Proxy: Off"
    });
}

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.local.get("socks5switch");

    if (!data.socks5switch) {
        await chrome.storage.local.set({
            socks5switch: "off"
        });
    }

    await updateActionIcon();
});

chrome.runtime.onStartup.addListener(updateActionIcon);

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.socks5switch) {
        updateActionIcon();
    }
});

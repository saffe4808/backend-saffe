export const normalizarOrigen = (valor) => {
    let origen = (valor || "").trim();
    if (!origen) {
        return "";
    }

    if (!/^https?:\/\//i.test(origen)) {
        origen = `https://${origen}`;
    }

    try {
        return new URL(origen).origin.toLowerCase();
    } catch {
        return origen.replace(/\/+$/, "").toLowerCase();
    }
};

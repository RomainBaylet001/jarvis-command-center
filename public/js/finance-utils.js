/* Pure validation and CSV helpers.
   Never read or write browser storage here. */

(function (root) {
  "use strict";

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(value + "T12:00:00Z");

    return (
      Number.isFinite(+date) &&
      date.toISOString().slice(0, 10) === value
    );
  }

  function validateTrades(trades) {
    if (!Array.isArray(trades) || trades.length > 1000) {
      throw Error("Expected at most 1,000 purchases.");
    }

    return trades.map((trade, index) => {
      if (
        !trade ||
        !validDate(trade.date) ||
        !["VWCE", "VFEA"].includes(trade.asset) ||
        !Number.isFinite(Number(trade.amount)) ||
        Number(trade.amount) <= 0 ||
        !Number.isFinite(Number(trade.shares)) ||
        Number(trade.shares) <= 0 ||
        (
          trade.purchasePrice != null &&
          trade.purchasePrice !== "" &&
          (
            !Number.isFinite(Number(trade.purchasePrice)) ||
            Number(trade.purchasePrice) < 0
          )
        )
      ) {
        throw Error(
          `Invalid purchase at row ${index + 1}. ` +
          "Check date, ETF, amount and shares."
        );
      }

      return {
        ...trade,
        amount: Number(trade.amount),
        shares: Number(trade.shares),
        purchasePrice: Number(trade.purchasePrice) || 0,
        broker: String(trade.broker || "")
      };
    });
  }

  function parseCsv(text) {
    text = text.replace(/^\uFEFF/, "").trim();

    if (text.length > 1048576) {
      throw Error("Backup exceeds 1 MB.");
    }

    const first = text.split(/\r?\n/)[0] || "";

    const delimiter = first.includes("\t")
      ? "\t"
      : first.includes(";") && !first.includes(",")
        ? ";"
        : ",";

    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
      const character = text[index];

      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (
        !quoted &&
        (
          character === delimiter ||
          character === "\n" ||
          character === "\r"
        )
      ) {
        row.push(field);
        field = "";

        if (character !== delimiter) {
          if (row.some(value => value.trim())) {
            rows.push(row);
          }

          row = [];

          if (
            character === "\r" &&
            text[index + 1] === "\n"
          ) {
            index++;
          }
        }
      } else {
        field += character;
      }
    }

    if (quoted) {
      throw Error("Unclosed quoted field in CSV.");
    }

    row.push(field);

    if (row.some(value => value.trim())) {
      rows.push(row);
    }

    if (rows[0]?.[0].trim().toLowerCase() === "date") {
      rows.shift();
    }

    if (!rows.length) {
      throw Error("No purchases in this CSV.");
    }

    return validateTrades(
      rows.map(
        ([date, asset, amount, shares, purchasePrice, broker]) => ({
          date: date?.trim(),
          asset: asset?.trim().toUpperCase(),
          amount,
          shares,
          purchasePrice,
          broker
        })
      )
    );
  }

  function toCsv(trades) {
    const rows = [
      ["date", "asset", "invested", "shares", "price", "broker"],
      ...trades.map(trade => [
        trade.date,
        trade.asset,
        trade.amount,
        trade.shares,
        trade.purchasePrice || "",
        trade.broker || ""
      ])
    ];

    return rows
      .map(row =>
        row
          .map(value =>
            '"' + String(value).replaceAll('"', '""') + '"'
          )
          .join(",")
      )
      .join("\r\n");
  }

  const api = {
    validDate,
    validateTrades,
    parseCsv,
    toCsv
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.NorthstarFinance = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

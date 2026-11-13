function innChecksum(digits, coefficients) {
  const sum = coefficients.reduce((total, coefficient, index) => total + coefficient * digits[index], 0);
  return (sum % 11) % 10;
}

export function isValidInn(value) {
  if (!/^\d{10}$|^\d{12}$/.test(value || "")) return false;
  const digits = value.split("").map(Number);
  if (digits.length === 10) {
    return innChecksum(digits, [2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  }
  const eleventh = innChecksum(digits, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
  const twelfth = innChecksum(digits, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
  return eleventh === digits[10] && twelfth === digits[11];
}

export function isValidOgrn(value, kind) {
  if (kind === "company") {
    if (!/^\d{13}$/.test(value || "")) return false;
    const expected = (BigInt(value.slice(0, 12)) % 11n) % 10n;
    return BigInt(value[12]) === expected;
  }
  if (kind === "ip") {
    if (!/^\d{15}$/.test(value || "")) return false;
    const expected = (BigInt(value.slice(0, 14)) % 13n) % 10n;
    return BigInt(value[14]) === expected;
  }
  return false;
}

export function makeInn12(base10) {
  if (!/^\d{10}$/.test(base10)) throw new Error("base");
  const digits = base10.split("").map(Number);
  digits.push(innChecksum(digits, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]));
  digits.push(innChecksum(digits, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]));
  return digits.join("");
}

export function makeInn10(base9) {
  if (!/^\d{9}$/.test(base9)) throw new Error("base");
  const digits = base9.split("").map(Number);
  digits.push(innChecksum(digits, [2, 4, 10, 3, 5, 9, 4, 6, 8]));
  return digits.join("");
}

export function makeOgrn13(base12) {
  if (!/^\d{12}$/.test(base12)) throw new Error("base");
  const check = (BigInt(base12) % 11n) % 10n;
  return base12 + check.toString();
}

export function makeOgrn15(base14) {
  if (!/^\d{14}$/.test(base14)) throw new Error("base");
  const check = (BigInt(base14) % 13n) % 10n;
  return base14 + check.toString();
}

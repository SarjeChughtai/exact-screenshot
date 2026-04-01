interface NamedPersonnelEntry {
  id: string;
  name: string;
  roles?: string[];
}

function normalizeName(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

export function resolvePersonnelUserId(
  personnel: NamedPersonnelEntry[],
  role: string,
  name: string | null | undefined,
) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return null;

  return personnel.find(person => {
    if (!person.id || !normalizeName(person.name)) return false;
    const roles = Array.isArray(person.roles) ? person.roles : [];
    return roles.includes(role) && normalizeName(person.name) === normalizedName;
  })?.id || null;
}

export function isQuoteAssignedToSalesRepUser(
  personnel: NamedPersonnelEntry[],
  quote: { salesRep?: string | null },
  currentUserId: string,
  currentUserName?: string | null,
) {
  const resolvedId = resolvePersonnelUserId(personnel, 'sales_rep', quote.salesRep);
  if (resolvedId) {
    return resolvedId === currentUserId;
  }

  return normalizeName(quote.salesRep) === normalizeName(currentUserName);
}

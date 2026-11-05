// Dropdown over the fixed tgd_r3_carcass_types list, grouped by animal
// (สุกร / โค / ไก่) the same way the ร.3 permit prints "ชนิด / ซากสัตว์".
export function R3CarcassTypeSelect({ value, onChange, carcassTypes = [], placeholder = '— ไม่ระบุ —', ...rest }) {
  const groups = [];
  for (const type of carcassTypes) {
    let group = groups.find((g) => g.animal === type.animal_type);
    if (!group) {
      group = { animal: type.animal_type, types: [] };
      groups.push(group);
    }
    group.types.push(type);
  }

  return (
    <select
      className="form-control"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      {...rest}
    >
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g.animal} label={g.animal}>
          {g.types.map((t) => <option key={t.code} value={t.code}>{t.label_th}</option>)}
        </optgroup>
      ))}
      {value && !carcassTypes.some((t) => t.code === value) && (
        <option value={value}>{value}</option>
      )}
    </select>
  );
}

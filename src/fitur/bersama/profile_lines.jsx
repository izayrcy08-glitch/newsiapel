export const ProfileLines = ({ name, nip, jabatan, nameClassName = "text-white font-semibold text-sm", metaClassName = "text-slate-500 text-xs", containerClassName = "" }) => {
  return (
    <div className={`min-w-0 ${containerClassName}`}>
      <div className={`${nameClassName} break-words`}>{name}</div>
      {nip ? <div className={`${metaClassName} mt-0.5 break-words`}>NIP: {nip}</div> : null}
      {jabatan ? <div className={`${metaClassName} mt-0.5 break-words`}>{jabatan}</div> : null}
    </div>
  );
};

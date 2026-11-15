export default function FormField({ label, id, ...props }) {
  return <div className="form-field"><label htmlFor={id}>{label}</label><input id={id} {...props} /></div>;
}

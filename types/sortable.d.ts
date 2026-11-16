// SortableJS is imported from npm as its UMD build (see docs/Architecture.md#production-dependencies).
// Its JavaScript is not type-checked; only the members in use are declared.
declare const Sortable: {
  create(element: HTMLElement, options: object): { destroy(): void };
};
export default Sortable;

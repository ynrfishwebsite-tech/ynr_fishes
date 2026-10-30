export const connection = null;
export const ReportQueue = {
  add: async (name, data) => ({ id: Date.now().toString(), name, data }),
  getJob: async (id) => null
};
export default { connection, ReportQueue };

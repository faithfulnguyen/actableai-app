import { SupersetClient } from "@superset-ui/connection";

export async function getCSRFToken(){
  return ((await SupersetClient.get({ 
      endpoint: '/superset/csrf_token/',
    })).json as any).csrf_token;
};

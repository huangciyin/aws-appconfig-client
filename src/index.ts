import {
  AppConfigDataClient,
  BadRequestException,
  GetLatestConfigurationCommand,
  StartConfigurationSessionCommand,
  StartConfigurationSessionCommandOutput
} from "@aws-sdk/client-appconfigdata";

const {
  AWS_REGION,
  APPCONFIG_APP_IDENTIFIER,
  APPCONFIG_CONFIG_PROFILE_IDENTIFIER,
  APPCONFIG_ENVIRONMENT_IDENTIFIER
} = process.env as any;

const client = new AppConfigDataClient({region: AWS_REGION});
let cacheToken: string;
let cacheConfig: any = null;
const refreshSeconds = 15;

export async function startConfigurationSession(): Promise<StartConfigurationSessionCommandOutput> {
  const params = {
    ApplicationIdentifier: APPCONFIG_APP_IDENTIFIER,
    EnvironmentIdentifier: APPCONFIG_ENVIRONMENT_IDENTIFIER,
    ConfigurationProfileIdentifier: APPCONFIG_CONFIG_PROFILE_IDENTIFIER,
    RequiredMinimumPollIntervalInSeconds: refreshSeconds
  };
  const command = new StartConfigurationSessionCommand(params);
  const data = await client.send(command);
  console.log("startConfigurationSession success.", JSON.stringify(data));
  const {InitialConfigurationToken} = data;
  cacheToken = InitialConfigurationToken;
  return data;
}


export default async function getConf() {
  if (!cacheConfig) {
    await tryRefreshConf();
  }
  return cacheConfig;
}

export async function startRefreshInterval() {
  setInterval(() => tryRefreshConf(), refreshSeconds*1000);
}

export async function tryRefreshConf() {
  try {
    await refreshConf();
  } catch (error) {
    // error handling.
    if (error.$$metadata) {
      const {requestId, cfId, extendedRequestId} = error.$$metadata;
      console.log(`get appconfig error. ${error.message}`, {requestId, cfId, extendedRequestId}, error);
    } else {
      console.log(`get appconfig error. ${error.message}`, error);
    }
  }
  return;
}

/**
 * featureFlag to get the flag is turned on
 * @param flag target feature flag
 * @returns return true when it's turned on
 */
export async function refreshConf({
                                    retryCount = 0
                                  }={}) {
  console.log(`refreshConf start. retryCount:${retryCount}, cacheToken:${cacheToken}`);
  if (retryCount > 3) {
    return;
  }
  if (!cacheToken) {
    await startConfigurationSession();
  }
  try {
    await getLatestConfiguration();
  } catch (err) {
    if (err instanceof BadRequestException) {
      await startConfigurationSession();
      // recall
      return refreshConf({
        retryCount: retryCount + 1
      });
    } else {
      throw err;
    }
  }
};

export async function getLatestConfiguration() {
  const params = {
    ConfigurationToken: cacheToken
  };
  const command = new GetLatestConfigurationCommand(params);
  const response = await client.send(command);
  if (!response.Configuration) {
    console.log(`tryResolveConfig skip,no new Configuration.`);
    return response;
  }
  let str = "";
  for (let i = 0; i < response.Configuration.length; i++) {
    str += String.fromCharCode(response.Configuration[i]);
  }
  if (str) {
    cacheConfig = JSON.parse(str);
  }
  console.log("getLatestConfiguration success.", str);
  return response;
}



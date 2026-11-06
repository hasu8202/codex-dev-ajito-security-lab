export const LAB_DATABASE_URL = 'file:./data/ajito-security-lab.db'

type LabRuntime = {
  hostname: string
  databaseUrl: string
}

export function assertLabRuntime({ hostname, databaseUrl }: LabRuntime): void {
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    throw new Error('この演習室は localhost でのみ実行できます。')
  }

  if (databaseUrl !== LAB_DATABASE_URL) {
    throw new Error('演習室は専用データベースでのみ実行できます。')
  }
}

export function labDatabaseFile(databaseUrl: string): string {
  if (databaseUrl !== LAB_DATABASE_URL) {
    throw new Error('演習室は専用データベースでのみ実行できます。')
  }
  return 'data/ajito-security-lab.db'
}

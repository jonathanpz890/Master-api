import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import { logger } from 'mnemonix';

export interface SlicingResult {
  weightg: number;
  timeSeconds: number;
  layerHeight: number;
  infillDensity: number;
  material: string;
  fileKey?: string;
}

export class SlicerService {
  private static activeJobs = 0;
  private static readonly MAX_CONCURRENT_JOBS = 2;
  private getSystemBblDir(): string {
    return path.resolve(__dirname, '../../bbl_presets');
  }

  // Resolves preset inherits chain recursively and merges them into a single self-contained JSON object
  private resolveConfig(filePath: string): any {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (content.inherits) {
      const parentName = content.inherits;
      const bblDir = this.getSystemBblDir();
      const parentPaths = [
        path.join(path.dirname(filePath), `${parentName}.json`),
        path.join(bblDir, 'process', `${parentName}.json`),
        path.join(bblDir, 'machine', `${parentName}.json`),
        path.join(bblDir, 'filament', `${parentName}.json`),
        path.join(bblDir, 'filament/P1P', `${parentName}.json`)
      ];
      let parentPath: string | null = null;
      for (const p of parentPaths) {
        if (fs.existsSync(p)) {
          parentPath = p;
          break;
        }
      }
      if (!parentPath) {
        throw new Error(`Parent preset "${parentName}" not found for ${filePath}`);
      }
      const parentContent = this.resolveConfig(parentPath);
      const merged = Object.assign({}, parentContent, content);
      delete merged.inherits;
      return merged;
    }
    delete content.inherits;
    return content;
  }

  // Maps input parameters to Bambu Studio JSON presets
  private getPresetPaths(layerHeight: number, material: string) {
    const bblDir = this.getSystemBblDir();

    // 1. Process Preset Mapping
    let processFile = 'process/0.20mm Standard @BBL X1C.json'; // Default standard
    if (layerHeight === 0.12) {
      processFile = 'process/0.12mm High Quality @BBL X1C.json';
    } else if (layerHeight === 0.28) {
      processFile = 'process/0.28mm Extra Draft @BBL X1C.json';
    }

    // 2. Filament Preset Mapping
    let filamentFile = 'filament/P1P/Generic PLA @BBL P1P.json';
    if (material.toUpperCase() === 'PETG') {
      filamentFile = 'filament/P1P/Generic PETG @BBL P1P.json';
    } else if (material.toUpperCase() === 'TPU') {
      filamentFile = 'filament/P1P/Generic TPU @BBL P1P.json';
    }

    // 3. Machine Preset
    const machineFile = 'machine/Bambu Lab P1S 0.4 nozzle.json';

    return {
      processPath: path.join(bblDir, processFile),
      filamentPath: path.join(bblDir, filamentFile),
      machinePath: path.join(bblDir, machineFile)
    };
  }

  public async sliceModel(
    stlFilePath: string,
    material: string,
    infill: number,
    layerHeight: number
  ): Promise<SlicingResult> {
    if (SlicerService.activeJobs >= SlicerService.MAX_CONCURRENT_JOBS) {
      throw new Error('SLICER_BUSY');
    }
    SlicerService.activeJobs++;
    const presets = this.getPresetPaths(layerHeight, material);
    
    // Create unique temporary directory for this slice job
    const runId = uuidv4();
    const tempDir = path.join(__dirname, `../../temp/jobs/${runId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const tempProcessPath = path.join(tempDir, 'process.json');
    const tempMachinePath = path.join(tempDir, 'machine.json');
    const tempFilamentPath = path.join(tempDir, 'filament.json');

    let success = false;

    try {
      // 1. Resolve and modify process preset
      const processJson = this.resolveConfig(presets.processPath);
      processJson.sparse_infill_density = `${infill}%`;
      fs.writeFileSync(tempProcessPath, JSON.stringify(processJson, null, 4));

      // 2. Resolve and modify machine preset
      const machineJson = this.resolveConfig(presets.machinePath);
      machineJson.printable_area = [
        "0x0",
        "1000x0",
        "1000x1000",
        "0x1000"
      ];
      machineJson.printable_height = "1000";
      machineJson.bed_exclude_area = [];
      machineJson.curr_bed_type = "Textured PEI Plate";
      fs.writeFileSync(tempMachinePath, JSON.stringify(machineJson, null, 4));

      // 3. Resolve and modify specific filament preset
      const filamentJson = this.resolveConfig(presets.filamentPath);
      filamentJson.compatible_printers = ["Bambu Lab P1S 0.4 nozzle"];
      fs.writeFileSync(tempFilamentPath, JSON.stringify(filamentJson, null, 4));

      // 4. Define slicing executor
      const runSlice = async (): Promise<void> => {
        const isLinux = process.platform === 'linux';
        const defaultBambuPath = isLinux 
          ? '/opt/bambustudio/AppRun' 
          : '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio';
        
        const bambuPath = process.env.BAMBU_STUDIO_PATH || defaultBambuPath;
        const bambuArgs = [
          '--slice', '0', '--arrange', '1', '--ensure-on-bed',
          '--load-settings', `${tempProcessPath};${tempMachinePath}`,
          '--load-filaments', tempFilamentPath,
          '--outputdir', tempDir, stlFilePath
        ];
        const executable = isLinux ? 'xvfb-run' : bambuPath;
        const args = isLinux ? ['-a', bambuPath, ...bambuArgs] : bambuArgs;

        logger.info('Slicing job started', { runId, material, infill, layerHeight });

        return new Promise<void>((resolve, reject) => {
          execFile(executable, args, { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              logger.error('Slicer CLI failed', { runId, code: error.code, stderr, stdout });
              
              const combinedOutput = `${stdout}\n${stderr}`;
              if (
                combinedOutput.includes('Nothing to be sliced') || 
                combinedOutput.includes('no object is fully inside') ||
                combinedOutput.includes('printable_height')
              ) {
                return reject(new Error('MODEL_TOO_LARGE'));
              }
              if (
                combinedOutput.includes('Loading of a model file failed') || 
                combinedOutput.includes('empty file')
              ) {
                return reject(new Error('INVALID_STL_FILE'));
              }
              
              return reject(new Error(`Slicing failed with exit code ${error.code}: ${error.message}`));
            }
            resolve();
          });
        });
      };

      // 4. Try to slice at 100% scale
      await runSlice();

      // 4. Parse results
      const resultPath = path.join(tempDir, 'result.json');
      if (!fs.existsSync(resultPath)) {
        throw new Error('Slicing completed but result.json was not generated.');
      }

      const resultJson = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      
      if (resultJson.return_code !== 0) {
        throw new Error(`Slicer reported error: ${resultJson.error_string}`);
      }

      const plate = resultJson.sliced_plates?.[0];
      if (!plate) {
        throw new Error('No plate data found in slicing results.');
      }

      const filamentData = plate.filaments?.[0];
      let weightg = filamentData ? filamentData.total_used_g : 0;
      let timeSeconds = plate.total_predication || 0;

      success = true;

      return {
        weightg: Number(weightg.toFixed(2)),
        timeSeconds: Number(timeSeconds.toFixed(1)),
        layerHeight,
        infillDensity: infill,
        material,
        fileKey: path.basename(stlFilePath)
      };

    } finally {
      // 5. Cleanup temp slicing directory and STL file (only delete STL file on failure)
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        if (!success && fs.existsSync(stlFilePath)) {
          fs.unlinkSync(stlFilePath);
        }
      } catch (cleanupErr) {
        logger.error('Slicing job cleanup error', { runId, error: cleanupErr });
      } finally {
        SlicerService.activeJobs--;
      }
    }
  }
}

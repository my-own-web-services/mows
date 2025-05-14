use crate::config::{VideoConfigCodec, CONFIG};
use anyhow::bail;
use std::{
    path::{Path, PathBuf},
    process::Command,
};

pub async fn convert(
    file_source_path: &PathBuf,
    file_target_folder: &PathBuf,
) -> anyhow::Result<()> {
    let config = &CONFIG;
    let video_quality = config.video.quality;
    let mut video_targets = config.video.target_resolutions.clone();
    let ffmpeg_path = "./ffmpeg";
    let ffprobe_path = "./ffprobe";
    video_targets.sort();

    let thumbnail_folder = Path::new(file_target_folder).join("t");

    std::fs::create_dir_all(thumbnail_folder)?;

    let mut resolution_command = Command::new(ffprobe_path);

    resolution_command.args([
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=x:p=0",
        file_source_path.to_str().unwrap(),
    ]);

    let output = resolution_command.output()?.stdout;
    let resolution_str = std::str::from_utf8(&output)?.trim();
    let resolution: Vec<&str> = resolution_str.split('x').collect();
    if resolution.len() != 2 {
        bail!("Invalid resolution:{:?}", resolution)
    }
    let height: u16 = resolution[1].parse()?;

    // dont create videos that are larger than the source
    let video_targets = video_targets
        .iter()
        .filter(|&&target| target <= height)
        .collect::<Vec<_>>();

    dbg!(&video_targets);

    let mut video_length_command = Command::new(ffprobe_path);

    video_length_command
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(file_source_path);

    let output = video_length_command.output()?.stdout;
    let video_length_str = std::str::from_utf8(&output)?.trim();
    let video_length: f64 = video_length_str.parse()?;

    dbg!(&video_length);

    let mut thumbnail_command = Command::new("nice");

    let thumbnail_count = 10.0;

    let a = video_length / thumbnail_count;

    thumbnail_command
        .arg("-n")
        .arg("19")
        .arg(ffmpeg_path)
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(file_source_path)
        .arg("-c:v")
        .arg("libwebp")
        .arg("-vf")
        .arg(format!("scale=-1:480,fps=1/{a}"))
        .arg(Path::new(file_target_folder).join("t/%d.webp"));

    thumbnail_command.spawn()?.wait()?;

    let mut video_command = Command::new("nice");

    video_command
        .arg("-n")
        .arg("19")
        .arg(ffmpeg_path)
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(file_source_path)
        .arg("-dash")
        .arg("1")
        .arg("-f")
        .arg("webm");

    for video_target in &video_targets {
        let video_target_path = Path::new(file_target_folder).join(format!("{video_target}.webm"));
        match config.video.codec {
            VideoConfigCodec::Vp9 => {
                video_command
                    .arg("-an")
                    .arg("-vf")
                    .arg(format!("scale=-1:{video_target}"))
                    .arg("-c:v")
                    .arg("libsvt_vp9")
                    .arg("-rc")
                    .arg("0")
                    .arg("-qp")
                    .arg(video_quality.to_string())
                    .arg("-dash")
                    .arg("1")
                    .arg(video_target_path);
            }
            VideoConfigCodec::Av1 => {
                video_command
                    .arg("-an")
                    .arg("-vf")
                    .arg(format!("scale=-1:{video_target}"))
                    .arg("-c:v")
                    .arg("libsvtav1")
                    .arg("-b:v")
                    .arg("0")
                    .arg("-crf")
                    .arg(video_quality.to_string())
                    .arg("-dash")
                    .arg("1")
                    .arg(video_target_path);
            }
        }
    }

    let video_command_exit_code = video_command.spawn()?.wait()?;

    if !video_command_exit_code.success() {
        bail!("Video command failed: {}", video_command_exit_code)
    }

    let mut audio_command = Command::new("nice");

    audio_command
        .arg("-n")
        .arg("19")
        .arg(ffmpeg_path)
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(file_source_path)
        .arg("-vn")
        .arg("-c:a")
        .arg("libopus")
        .arg("-b:a")
        .arg("128k")
        .arg("-f")
        .arg("webm")
        .arg("-dash")
        .arg("1")
        .arg(Path::new(file_target_folder).join("audio.webm"));

    let audio_result = audio_command.spawn()?.wait();

    let mut manifest_command = Command::new("nice");

    manifest_command
        .arg("-n")
        .arg("19")
        .arg(ffmpeg_path)
        .arg("-hide_banner")
        .arg("-y");

    let mut all_targets = 0;
    let mut video_adaption_sets = "".to_string();
    let mut audio_adaption_sets = "".to_string();

    for (i, video_target) in video_targets.iter().enumerate() {
        manifest_command
            .arg("-f")
            .arg("webm_dash_manifest")
            .arg("-i")
            .arg(Path::new(file_target_folder).join(format!("{video_target}.webm")));
        video_adaption_sets += format!("{},", i).as_str();
        all_targets += 1;
    }

    if audio_result.is_ok() {
        manifest_command
            .arg("-f")
            .arg("webm_dash_manifest")
            .arg("-i")
            .arg(Path::new(file_target_folder).join("audio.webm"));
        audio_adaption_sets += format!("{},", video_targets.len()).as_str();

        all_targets += 1;
    }

    manifest_command.arg("-c").arg("copy");

    for num in 0..all_targets {
        manifest_command.arg("-map").arg(num.to_string());
    }

    video_adaption_sets.pop();
    audio_adaption_sets.pop();

    let adaption_sets = match audio_result {
        Ok(_) => format!("id=0,streams={video_adaption_sets} id=1,streams={audio_adaption_sets}"),
        Err(_) => format!("id=0,streams={video_adaption_sets}"),
    };

    let manifest_path = Path::new(file_target_folder).join("manifest.mpd");

    manifest_command
        .arg("-f")
        .arg("webm_dash_manifest")
        .arg("-adaptation_sets")
        .arg(adaption_sets)
        .arg(&manifest_path);

    let manifest_command_exit_code = manifest_command.spawn()?.wait()?;

    if !manifest_command_exit_code.success() {
        bail!("Manifest command failed")
    }

    // fix manifest
    if config.video.codec == VideoConfigCodec::Av1 {
        let manifest = tokio::fs::read_to_string(&manifest_path).await?;
        let manifest = manifest.replace(r#"codecs="av1""#, r#"codecs="av01.0.00M.08""#);
        tokio::fs::write(&manifest_path, manifest).await?;
    };

    Ok(())
}

// switch back to using av1 as soon as it works with dash

/*
  // pack all files into an archive
    let file = File::create(format!("{target_folder}{file_id}.dash.tar"))?;
    let mut tar = tar::Builder::new(file);

    for video_target in &video_targets {
        let name = format!("{target_folder}{video_target}.webm");
        let mut file = File::open(&name)?;
        tar.append_file(format!("{video_target}.webm"), &mut file)?;
    }

    match audio_result {
        Ok(_) => {
            let name = format!("{target_folder}audio.webm");
            let mut file = File::open(&name)?;
            tar.append_file("audio.webm", &mut file)?;
        }
        Err(_) => {}
    };

    let name = format!("{target_folder}manifest.mpd");
    let mut file = File::open(&name)?;
    tar.append_file("manifest.mpd", &mut file)?;
    std::fs::remove_dir_all(temp_folder)?;

*/
